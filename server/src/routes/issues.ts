/**
 * Route: /api/repo (GitHub Data: Issues, PRs, Commits, PR Diffs)
 * Replaces: Direct GitHub API calls previously executed in the client browser
 *
 * Endpoints:
 *   - POST /api/repo/issues         - Fetches GitHub issues (excludes PRs, body capped at 2,000 chars)
 *   - GET  /api/repo/pulls          - Fetches GitHub pull requests
 *   - GET  /api/repo/commits        - Fetches GitHub commits (most recent 30)
 *   - GET  /api/repo/pulls/:pr/diff - Fetches PR diff text (application/vnd.github.v3.diff)
 */

import { Router, Request, Response } from "express";
import { resolveGithubToken } from "../lib/githubAuth.js";

const router = Router();

// POST /api/repo/issues
router.post("/issues", async (req: Request, res: Response) => {
  try {
    const { owner, repo, state = "open", per_page = 30, githubToken } = req.body;
    if (!owner || !repo) {
      return res.status(400).json({ error: "owner and repo parameters required" });
    }

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "GitPlus-AI",
    };
    const resolvedToken = await resolveGithubToken(req, githubToken);
    if (resolvedToken) {
      headers.Authorization = `Bearer ${resolvedToken}`;
    }

    const params = new URLSearchParams({
      state: String(state),
      per_page: String(per_page),
      sort: "updated",
      direction: "desc",
    });

    const resp = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues?${params}`,
      { headers }
    );

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      if (resp.status === 404) {
        return res.status(404).json({ error: `Repository ${owner}/${repo} not found or private.` });
      }
      if (resp.status === 403) {
        return res.status(403).json({ error: "GitHub API rate limit reached. Add a GitHub Token." });
      }
      return res.status(resp.status).json({ error: `GitHub API error ${resp.status}: ${errText}` });
    }

    const issues = (await resp.json()) as any[];
    const filtered = issues
      .filter((i: any) => !i.pull_request)
      .map((i: any) => ({
        number: i.number,
        title: i.title,
        body: (i.body || "").slice(0, 2000),
        state: i.state,
        labels: (i.labels || []).map((l: any) => ({ name: l.name, color: l.color })),
        user: i.user ? { login: i.user.login, avatar_url: i.user.avatar_url } : { login: "ghost", avatar_url: "" },
        comments: i.comments || 0,
        created_at: i.created_at,
        updated_at: i.updated_at,
        html_url: i.html_url,
      }));

    return res.json({ issues: filtered });
  } catch (err: any) {
    console.error("[issues route error]:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch issues" });
  }
});

// GET /api/repo/pulls
router.get("/pulls", async (req: Request, res: Response) => {
  try {
    const { owner, repo, state = "open", githubToken } = req.query as Record<string, string>;
    if (!owner || !repo) {
      return res.status(400).json({ error: "owner and repo query parameters required" });
    }

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "GitPlus-AI",
    };
    const resolvedToken = await resolveGithubToken(req, githubToken);
    if (resolvedToken) {
      headers.Authorization = `Bearer ${resolvedToken}`;
    }

    const params = new URLSearchParams({
      state: String(state),
      per_page: "30",
      sort: "updated",
      direction: "desc",
    });

    const resp = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls?${params}`,
      { headers }
    );

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      if (resp.status === 404) return res.status(404).json({ error: `Repository ${owner}/${repo} not found.` });
      if (resp.status === 403) return res.status(403).json({ error: "GitHub API rate limit reached." });
      return res.status(resp.status).json({ error: `GitHub API error ${resp.status}: ${errText}` });
    }

    const pulls = (await resp.json()) as any[];
    return res.json({
      pulls: pulls.map((p: any) => ({
        number: p.number,
        title: p.title,
        body: (p.body || "").slice(0, 2000),
        state: p.state,
        user: p.user ? { login: p.user.login, avatar_url: p.user.avatar_url } : { login: "ghost", avatar_url: "" },
        created_at: p.created_at,
        updated_at: p.updated_at,
        html_url: p.html_url,
        draft: Boolean(p.draft),
        merged_at: p.merged_at || null,
      })),
    });
  } catch (err: any) {
    console.error("[pulls route error]:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch pull requests" });
  }
});

// GET /api/repo/commits
router.get("/commits", async (req: Request, res: Response) => {
  try {
    const { owner, repo, githubToken } = req.query as Record<string, string>;
    if (!owner || !repo) {
      return res.status(400).json({ error: "owner and repo query parameters required" });
    }

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "GitPlus-AI",
    };
    const resolvedToken = await resolveGithubToken(req, githubToken);
    if (resolvedToken) {
      headers.Authorization = `Bearer ${resolvedToken}`;
    }

    const resp = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=30`,
      { headers }
    );

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      if (resp.status === 404) return res.status(404).json({ error: `Repository ${owner}/${repo} not found.` });
      if (resp.status === 403) return res.status(403).json({ error: "GitHub API rate limit reached." });
      return res.status(resp.status).json({ error: `GitHub API error ${resp.status}: ${errText}` });
    }

    const commits = (await resp.json()) as any[];
    return res.json({
      commits: commits.map((c: any) => ({
        sha: c.sha,
        commit: {
          message: c.commit?.message || "",
          author: {
            name: c.commit?.author?.name || "Unknown",
            date: c.commit?.author?.date || "",
          },
        },
        author: c.author ? { login: c.author.login, avatar_url: c.author.avatar_url } : null,
        html_url: c.html_url,
      })),
    });
  } catch (err: any) {
    console.error("[commits route error]:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch commits" });
  }
});

// GET /api/repo/pulls/:pr/diff
router.get("/pulls/:pr/diff", async (req: Request, res: Response) => {
  try {
    const { owner, repo, githubToken } = req.query as Record<string, string>;
    const { pr } = req.params;
    if (!owner || !repo || !pr) {
      return res.status(400).json({ error: "owner, repo, and pr number required" });
    }

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3.diff",
      "User-Agent": "GitPlus-AI",
    };
    const resolvedToken = await resolveGithubToken(req, githubToken);
    if (resolvedToken) {
      headers.Authorization = `Bearer ${resolvedToken}`;
    }

    const resp = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${pr}`,
      { headers }
    );

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      if (resp.status === 404) return res.status(404).json({ error: `Pull Request #${pr} not found.` });
      if (resp.status === 403) return res.status(403).json({ error: "GitHub API rate limit reached." });
      return res.status(resp.status).json({ error: `GitHub API error ${resp.status}: ${errText}` });
    }

    const diffText = await resp.text();
    res.setHeader("Content-Type", "text/plain");
    return res.send(diffText);
  } catch (err: any) {
    console.error("[pr diff route error]:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch PR diff" });
  }
});

export default router;
