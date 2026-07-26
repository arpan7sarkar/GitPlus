/**
 * VexReview — public entry point.
 * Everything the rest of the server needs to trigger a review lives here;
 * callers shouldn't need to know about Commenter/Inputs/Prompts internals.
 */

import { createVexReviewOctokit } from "./octokit.js";
import { reviewPullRequest, type ReviewProgress, type ReviewResult } from "./review.js";
import { VexReviewOptions, type VexReviewOptionsInit } from "./config.js";

export type { ReviewProgress, ReviewResult };
export { VexReviewOptions };

export async function runVexReview(params: {
  githubToken: string;
  owner: string;
  repo: string;
  prNumber: number;
  optionsInit?: VexReviewOptionsInit;
  onProgress?: (p: ReviewProgress) => void;
}): Promise<ReviewResult> {
  const octokit = createVexReviewOctokit(params.githubToken);
  const options = new VexReviewOptions(params.optionsInit);
  return reviewPullRequest(
    octokit,
    { owner: params.owner, repo: params.repo },
    params.prNumber,
    options,
    params.onProgress
  );
}
