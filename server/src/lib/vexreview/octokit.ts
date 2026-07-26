/**
 * Octokit factory for VexReview.
 * The original Action used @octokit/action, which reads GITHUB_TOKEN from the
 * Actions runner env automatically. Here the token is explicit — it's the
 * requesting user's own GitHub OAuth token (decrypted server-side), so review
 * comments are posted as that user, not a bot account.
 */

import { Octokit } from "@octokit/rest";

export function createVexReviewOctokit(token: string): Octokit {
  return new Octokit({ auth: token, userAgent: "GitPlus-VexReview" });
}
