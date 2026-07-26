/**
 * GitHub Token Resolution
 * Used by routes that call the GitHub REST API (repo.ts, issues.ts) so a logged-in
 * user's own OAuth token is used automatically — raising the rate limit from
 * 60 req/hr (unauthenticated) to 5000 req/hr and allowing access to private repos —
 * without every frontend call needing to pass a token explicitly.
 *
 * Precedence: explicit token (request body/query) > logged-in session's stored token.
 */

import type { Request } from "express";
import { getSessionUser, readSessionToken } from "./auth.js";
import { decrypt } from "./crypto.js";

export async function resolveGithubToken(
  req: Request,
  explicitToken?: string
): Promise<string | undefined> {
  if (explicitToken) return explicitToken;

  const user = await getSessionUser(readSessionToken(req));
  if (!user) return undefined;

  try {
    return decrypt(user.accessToken);
  } catch (err) {
    console.error("[githubAuth] Failed to decrypt stored access token:", err);
    return undefined;
  }
}
