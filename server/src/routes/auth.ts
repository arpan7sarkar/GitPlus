/**
 * Route: /api/auth
 * GitHub OAuth login — lets a user sign in with GitHub so:
 *   1. GitHub API calls made on their behalf use their own token (5000 req/hr
 *      instead of the 60 req/hr unauthenticated limit, plus private-repo access).
 *   2. The account and every session are recorded in Postgres (`users`, `sessions`)
 *      instead of vanishing on refresh, giving real accountability for who indexed
 *      what.
 *
 * Endpoints:
 *   - GET  /api/auth/github          - Redirects to GitHub's OAuth consent screen
 *   - GET  /api/auth/github/callback - Exchanges the code, upserts the user, opens a session
 *   - GET  /api/auth/me              - Returns the current session's user (or 401)
 *   - GET  /api/auth/repos           - Lists the current user's GitHub repos
 *   - POST /api/auth/logout          - Destroys the current session
 */

import { Router, Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { encrypt, decrypt } from "../lib/crypto.js";
import { createSession, destroySession, getSessionUser, readSessionToken, SESSION_COOKIE, SESSION_TTL_MS } from "../lib/auth.js";

const router = Router();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "";
const GITHUB_CALLBACK_URL =
  process.env.GITHUB_OAUTH_CALLBACK_URL || "http://localhost:3000/api/auth/github/callback";
const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:8080").replace(/\/+$/, "");

const STATE_COOKIE = "gitplus_oauth_state";
const isProd = process.env.NODE_ENV === "production";

function cookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    maxAge: maxAgeMs,
    path: "/",
  };
}

// GET /api/auth/github
router.get("/github", (req: Request, res: Response) => {
  if (!GITHUB_CLIENT_ID) {
    return res
      .status(500)
      .json({ error: "GitHub OAuth is not configured (missing GITHUB_CLIENT_ID on the server)" });
  }

  const state = crypto.randomBytes(16).toString("hex");
  res.cookie(STATE_COOKIE, state, cookieOptions(10 * 60 * 1000));

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_CALLBACK_URL,
    scope: "read:user user:email repo",
    state,
    allow_signup: "true",
  });

  return res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

// GET /api/auth/github/callback
router.get("/github/callback", async (req: Request, res: Response) => {
  const cookieState = (req as any).cookies?.[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE, { path: "/" });

  try {
    const { code, state } = req.query as Record<string, string>;

    if (!code || !state || !cookieState || state !== cookieState) {
      return res.redirect(`${FRONTEND_URL}/?auth_error=invalid_state`);
    }

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: GITHUB_CALLBACK_URL,
      }),
    });
    const tokenData = (await tokenRes.json()) as any;

    if (!tokenData.access_token) {
      console.error("[auth] GitHub token exchange failed:", tokenData);
      return res.redirect(`${FRONTEND_URL}/?auth_error=token_exchange_failed`);
    }
    const accessToken: string = tokenData.access_token;

    const ghHeaders = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "GitPlus-AI",
    };

    const [profileRes, emailsRes] = await Promise.all([
      fetch("https://api.github.com/user", { headers: ghHeaders }),
      fetch("https://api.github.com/user/emails", { headers: ghHeaders }),
    ]);

    if (!profileRes.ok) {
      console.error("[auth] GitHub profile fetch failed:", profileRes.status);
      return res.redirect(`${FRONTEND_URL}/?auth_error=profile_fetch_failed`);
    }

    const profile = (await profileRes.json()) as any;
    const emails = await emailsRes.json().catch(() => []);
    const primaryEmail = Array.isArray(emails)
      ? emails.find((e: any) => e.primary)?.email || emails[0]?.email
      : undefined;

    const user = await prisma.user.upsert({
      where: { githubId: String(profile.id) },
      create: {
        githubId: String(profile.id),
        username: profile.login,
        name: profile.name || null,
        email: primaryEmail || profile.email || null,
        avatarUrl: profile.avatar_url || null,
        accessToken: encrypt(accessToken),
      },
      update: {
        username: profile.login,
        name: profile.name || null,
        email: primaryEmail || profile.email || null,
        avatarUrl: profile.avatar_url || null,
        accessToken: encrypt(accessToken),
      },
    });

    const { token } = await createSession(user.id);
    res.cookie(SESSION_COOKIE, token, cookieOptions(SESSION_TTL_MS));

    return res.redirect(`${FRONTEND_URL}/`);
  } catch (err: any) {
    console.error("[auth] GitHub OAuth callback error:", err);
    return res.redirect(`${FRONTEND_URL}/?auth_error=server_error`);
  }
});

// GET /api/auth/me
router.get("/me", async (req: Request, res: Response) => {
  const user = await getSessionUser(readSessionToken(req));
  if (!user) return res.status(401).json({ user: null });

  let providerToken: string | null = null;
  try {
    providerToken = decrypt(user.accessToken);
  } catch (err) {
    console.error("[auth] Failed to decrypt stored access token:", err);
  }

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      created_at: user.createdAt,
      user_metadata: {
        avatar_url: user.avatarUrl,
        user_name: user.username,
        full_name: user.name,
      },
    },
    session: providerToken ? { provider_token: providerToken } : null,
  });
});

// GET /api/auth/repos
router.get("/repos", async (req: Request, res: Response) => {
  const user = await getSessionUser(readSessionToken(req));
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  try {
    const token = decrypt(user.accessToken);
    const ghRes = await fetch(
      "https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "GitPlus-AI",
        },
      }
    );

    if (!ghRes.ok) {
      const details = await ghRes.text().catch(() => "");
      return res.status(ghRes.status).json({ error: "Failed to fetch repositories from GitHub", details });
    }

    const repos = await ghRes.json();
    return res.json(repos);
  } catch (err: any) {
    console.error("[auth] fetch user repos error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch repositories" });
  }
});

// GET /api/auth/indexed-repos — repos this user has analyzed on GitPlus (not GitHub's list)
router.get("/indexed-repos", async (req: Request, res: Response) => {
  const user = await getSessionUser(readSessionToken(req));
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const repos = await prisma.indexedRepo.findMany({
    where: { userId: user.id },
    orderBy: { lastIndexedAt: "desc" },
  });

  return res.json({ repos });
});

// POST /api/auth/logout
router.post("/logout", async (req: Request, res: Response) => {
  await destroySession(readSessionToken(req));
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  return res.json({ success: true });
});

export default router;
