/**
 * VexReview Engine — ported from the GitHub Action's review.ts.
 *
 * Behavioral differences from the original Action:
 *   - Takes explicit {owner, repo, prNumber, octokit} instead of reading
 *     @actions/github's `context` (only populated inside an Actions runner).
 *   - Fetches the PR via `octokit.pulls.get()` itself rather than reading
 *     `context.payload.pull_request`.
 *   - Uses the shared llm.ts completeText() (Gemini->OpenAI failover) instead
 *     of a dedicated @google/genai Bot class — one failover path for the whole
 *     server instead of two independent implementations.
 *   - Drops the base-file-content fetch: the original action fetched it via
 *     `repos.getContent()` per file but never actually used it in either the
 *     summarize or review prompts (verified against the upstream source) — real
 *     API calls for a value nothing reads.
 *   - Drops the interactive "reply to review comment" chat feature
 *     (handleReviewComment.ts) — out of scope for a "review this PR" button.
 *   - Sensitive-file detection reports instead of auto-closing the PR (see
 *     config.ts's findSensitiveFiles doc comment for why).
 *   - Token counting uses a char-based estimate (config.ts's estimateTokens)
 *     instead of pulling in the tiktoken WASM tokenizer for one heuristic.
 */

import type { Octokit } from "@octokit/rest";
import pLimit from "p-limit";
import { completeText } from "../llm.js";
import {
  Commenter,
  COMMENT_REPLY_TAG,
  RAW_SUMMARY_END_TAG,
  RAW_SUMMARY_START_TAG,
  SHORT_SUMMARY_END_TAG,
  SHORT_SUMMARY_START_TAG,
  SUMMARIZE_TAG,
  type RepoRef,
} from "./commenter.js";
import { Inputs } from "./inputs.js";
import { Prompts } from "./prompts.js";
import { VexReviewOptions, estimateTokens, findSensitiveFiles, DEFAULT_SUMMARIZE_PROMPT, DEFAULT_RELEASE_NOTES_PROMPT } from "./config.js";

const IGNORE_KEYWORD = "@vexreview: ignore";

export interface ReviewProgress {
  stage: "diffing" | "summarizing" | "reviewing" | "posting" | "done";
  message: string;
  filesTotal?: number;
  filesDone?: number;
}

export interface ReviewResult {
  status: "reviewed" | "skipped" | "rejected_sensitive_files";
  reason?: string;
  filesReviewed: number;
  reviewCommentCount: number;
  lgtmCount: number;
  sensitiveFiles?: string[];
  summaryCommentUrl?: string;
}

async function chat(systemMessage: string, prompt: string, maxTokens: number): Promise<string> {
  return completeText({
    systemPrompt: systemMessage,
    userContent: prompt,
    maxTokens,
    temperature: 0.5,
    label: "vexreview",
  });
}

export async function reviewPullRequest(
  octokit: Octokit,
  repo: RepoRef,
  prNumber: number,
  options: VexReviewOptions,
  onProgress?: (p: ReviewProgress) => void
): Promise<ReviewResult> {
  const commenter = new Commenter(octokit);
  const geminiConcurrencyLimit = pLimit(options.concurrencyLimit);
  const prompts = new Prompts(DEFAULT_SUMMARIZE_PROMPT, DEFAULT_RELEASE_NOTES_PROMPT);

  const progress = (p: ReviewProgress) => onProgress?.(p);

  progress({ stage: "diffing", message: "Fetching pull request..." });

  const { data: pr } = await octokit.pulls.get({
    owner: repo.owner,
    repo: repo.repo,
    pull_number: prNumber,
  });

  const inputs = new Inputs();
  inputs.title = pr.title;
  if (pr.body) inputs.description = commenter.getDescription(pr.body);

  if (inputs.description.includes(IGNORE_KEYWORD)) {
    return { status: "skipped", reason: "PR description contains @vexreview: ignore", filesReviewed: 0, reviewCommentCount: 0, lgtmCount: 0 };
  }

  inputs.systemMessage = options.systemMessage;

  const existingSummarizeCmt = await commenter.findCommentWithTag(SUMMARIZE_TAG, prNumber, repo);
  let existingCommitIdsBlock = "";
  if (existingSummarizeCmt != null) {
    const body = existingSummarizeCmt.body as string;
    inputs.rawSummary = commenter.getRawSummary(body);
    inputs.shortSummary = commenter.getShortSummary(body);
    existingCommitIdsBlock = commenter.getReviewedCommitIdsBlock(body);
  }

  const allCommitIds = await commenter.getAllCommitIds(prNumber, repo);
  let highestReviewedCommitId = "";
  if (existingCommitIdsBlock !== "") {
    highestReviewedCommitId = commenter.getHighestReviewedCommitId(
      allCommitIds,
      commenter.getReviewedCommitIds(existingCommitIdsBlock)
    );
  }
  if (highestReviewedCommitId === "" || highestReviewedCommitId === pr.head.sha) {
    highestReviewedCommitId = pr.base.sha;
  }

  const incrementalDiff = await octokit.repos.compareCommits({
    owner: repo.owner,
    repo: repo.repo,
    base: highestReviewedCommitId,
    head: pr.head.sha,
  });
  const targetBranchDiff = await octokit.repos.compareCommits({
    owner: repo.owner,
    repo: repo.repo,
    base: pr.base.sha,
    head: pr.head.sha,
  });

  const incrementalFiles = incrementalDiff.data.files;
  const targetBranchFiles = targetBranchDiff.data.files;
  if (incrementalFiles == null || targetBranchFiles == null) {
    return { status: "skipped", reason: "No file diff data returned by GitHub", filesReviewed: 0, reviewCommentCount: 0, lgtmCount: 0 };
  }

  const sensitiveFiles = findSensitiveFiles(targetBranchFiles.map((f) => f.filename));
  if (sensitiveFiles.length > 0) {
    const message = `This pull request touches files that look like secrets or credentials and were **not reviewed**:\n\n${sensitiveFiles
      .map((f) => `- \`${f}\``)
      .join("\n")}\n\nPlease double-check these aren't committing real secrets before merging. If this is a false positive, you can safely ignore this notice.`;
    await commenter.comment(message, SUMMARIZE_TAG, prNumber, repo);
    return { status: "rejected_sensitive_files", sensitiveFiles, filesReviewed: 0, reviewCommentCount: 0, lgtmCount: 0 };
  }

  const files = targetBranchFiles.filter((targetBranchFile) =>
    incrementalFiles.some((incrementalFile) => incrementalFile.filename === targetBranchFile.filename)
  );
  if (files.length === 0) {
    return { status: "skipped", reason: "No files changed in the incremental diff", filesReviewed: 0, reviewCommentCount: 0, lgtmCount: 0 };
  }

  const filterSelectedFiles: typeof files = [];
  const filterIgnoredFiles: typeof files = [];
  for (const file of files) {
    if (options.checkPath(file.filename)) filterSelectedFiles.push(file);
    else filterIgnoredFiles.push(file);
  }
  if (filterSelectedFiles.length === 0) {
    return { status: "skipped", reason: "All changed files are excluded by path filters", filesReviewed: 0, reviewCommentCount: 0, lgtmCount: 0 };
  }

  const commits = incrementalDiff.data.commits;
  if (commits.length === 0) {
    return { status: "skipped", reason: "No commits in the incremental diff", filesReviewed: 0, reviewCommentCount: 0, lgtmCount: 0 };
  }

  // ─── Build hunks per file ────────────────────────────────────────────────
  progress({ stage: "summarizing", message: "Parsing diff hunks...", filesTotal: filterSelectedFiles.length });

  const filesAndChanges: Array<[string, string, Array<[number, number, string]>]> = [];
  for (const file of filterSelectedFiles) {
    const patches: Array<[number, number, string]> = [];
    for (const patch of splitPatch(file.patch)) {
      const patchLines = patchStartEndLine(patch);
      if (patchLines == null) continue;
      const hunks = parsePatch(patch);
      if (hunks == null) continue;
      const hunksStr = `\n---new_hunk---\n\`\`\`\n${hunks.newHunk}\n\`\`\`\n\n---old_hunk---\n\`\`\`\n${hunks.oldHunk}\n\`\`\`\n`;
      patches.push([patchLines.newHunk.startLine, patchLines.newHunk.endLine, hunksStr]);
    }
    if (patches.length > 0) {
      filesAndChanges.push([file.filename, file.patch || "", patches]);
    }
  }

  if (filesAndChanges.length === 0) {
    return { status: "skipped", reason: "No reviewable hunks found", filesReviewed: 0, reviewCommentCount: 0, lgtmCount: 0 };
  }

  // ─── Summarize each file ────────────────────────────────────────────────
  const summariesFailed: string[] = [];
  const doSummary = async (filename: string, fileDiff: string): Promise<[string, string, boolean] | null> => {
    if (fileDiff.length === 0) {
      summariesFailed.push(`${filename} (empty diff)`);
      return null;
    }
    const ins = inputs.clone();
    ins.filename = filename;
    ins.fileDiff = fileDiff;

    const summarizePrompt = prompts.renderSummarizeFileDiff(ins, options.reviewSimpleChanges);
    if (estimateTokens(summarizePrompt) > options.tokenLimits.requestTokens) {
      summariesFailed.push(`${filename} (diff too large)`);
      return null;
    }

    const summarizeResp = await chat(inputs.systemMessage, summarizePrompt, 400);
    if (summarizeResp === "") {
      summariesFailed.push(`${filename} (no response from model)`);
      return null;
    }
    if (options.reviewSimpleChanges === false) {
      const triageMatch = summarizeResp.match(/\[TRIAGE\]:\s*(NEEDS_REVIEW|APPROVED)/);
      if (triageMatch != null) {
        const needsReview = triageMatch[1] === "NEEDS_REVIEW";
        return [filename, summarizeResp.replace(/\[TRIAGE\]:\s*(NEEDS_REVIEW|APPROVED)/, "").trim(), needsReview];
      }
    }
    return [filename, summarizeResp, true];
  };

  const skippedFiles: string[] = [];
  const summaryTargets = filesAndChanges.slice(0, options.maxFiles > 0 ? options.maxFiles : undefined);
  if (options.maxFiles > 0 && filesAndChanges.length > options.maxFiles) {
    skippedFiles.push(...filesAndChanges.slice(options.maxFiles).map(([f]) => f));
  }

  let doneCount = 0;
  const summaries = (
    await Promise.all(
      summaryTargets.map(([filename, fileDiff]) =>
        geminiConcurrencyLimit(async () => {
          const result = await doSummary(filename, fileDiff);
          doneCount++;
          progress({ stage: "summarizing", message: `Summarizing ${filename}`, filesTotal: summaryTargets.length, filesDone: doneCount });
          return result;
        })
      )
    )
  ).filter((s): s is [string, string, boolean] => s !== null);

  if (summaries.length > 0) {
    const batchSize = 10;
    for (let i = 0; i < summaries.length; i += batchSize) {
      for (const [filename, summary] of summaries.slice(i, i + batchSize)) {
        inputs.rawSummary += `---\n${filename}: ${summary}\n`;
      }
      const summarizeResp = await chat(inputs.systemMessage, prompts.renderSummarizeChangesets(inputs), 800);
      if (summarizeResp !== "") inputs.rawSummary = summarizeResp;
    }
  }

  const summarizeFinalResponse = await chat(inputs.systemMessage, prompts.renderSummarize(inputs), 900);

  if (!options.disableReleaseNotes) {
    const releaseNotesResponse = await chat(inputs.systemMessage, prompts.renderSummarizeReleaseNotes(inputs), 300);
    if (releaseNotesResponse !== "") {
      try {
        await commenter.updateDescription(prNumber, `### Summary by VexReview\n\n${releaseNotesResponse}`, repo);
      } catch (e) {
        console.warn("[vexreview] Failed to update PR description with release notes:", e);
      }
    }
  }

  const summarizeShortResponse = await chat(inputs.systemMessage, prompts.renderSummarizeShort(inputs), 700);
  inputs.shortSummary = summarizeShortResponse;

  let summarizeComment = `${summarizeFinalResponse}
${RAW_SUMMARY_START_TAG}
${inputs.rawSummary}
${RAW_SUMMARY_END_TAG}
${SHORT_SUMMARY_START_TAG}
${inputs.shortSummary}
${SHORT_SUMMARY_END_TAG}

---

<details>
<summary>About VexReview</summary>

This review was generated by **VexReview**, triggered from GitPlus.
</details>
`;

  let statusMsg = `<details>
<summary>Files selected (${filesAndChanges.length})</summary>

* ${filesAndChanges.map(([filename, , patches]) => `${filename} (${patches.length})`).join("\n* ")}
</details>
${filterIgnoredFiles.length > 0 ? `<details>\n<summary>Files ignored due to filter (${filterIgnoredFiles.length})</summary>\n\n* ${filterIgnoredFiles.map((f) => f.filename).join("\n* ")}\n</details>\n` : ""}`;

  let reviewCount = 0;
  let lgtmCount = 0;

  if (!options.disableReview) {
    progress({ stage: "reviewing", message: "Reviewing files...", filesTotal: filesAndChanges.length, filesDone: 0 });

    const filesAndChangesReview = filesAndChanges.filter(([filename]) => {
      const needsReview = summaries.find(([summaryFilename]) => summaryFilename === filename)?.[2] ?? true;
      return needsReview;
    });
    const reviewsSkipped = filesAndChanges
      .filter(([filename]) => !filesAndChangesReview.some(([reviewFilename]) => reviewFilename === filename))
      .map(([filename]) => filename);
    const reviewsFailed: string[] = [];

    const doReview = async (filename: string, patches: Array<[number, number, string]>): Promise<void> => {
      const ins = inputs.clone();
      ins.filename = filename;

      let tokens = estimateTokens(prompts.renderReviewFileDiff(ins));
      let patchesToPack = 0;
      for (const [, , patch] of patches) {
        const patchTokens = estimateTokens(patch);
        if (tokens + patchTokens > options.tokenLimits.requestTokens) break;
        tokens += patchTokens;
        patchesToPack += 1;
      }

      let patchesPacked = 0;
      for (const [startLine, endLine, patch] of patches) {
        if (patchesPacked >= patchesToPack) break;
        patchesPacked += 1;

        let commentChain = "";
        try {
          commentChain = await commenter.getCommentChainsWithinRange(
            prNumber,
            filename,
            startLine,
            endLine,
            repo,
            COMMENT_REPLY_TAG
          );
        } catch (e) {
          console.warn("[vexreview] Failed to get comment chain:", e);
        }
        const commentChainTokens = estimateTokens(commentChain);
        if (tokens + commentChainTokens <= options.tokenLimits.requestTokens) {
          tokens += commentChainTokens;
        } else {
          commentChain = "";
        }

        ins.patches += `\n${patch}\n`;
        if (commentChain !== "") ins.patches += `\n---comment_chains---\n\`\`\`\n${commentChain}\n\`\`\`\n`;
        ins.patches += `\n---end_change_section---\n`;
      }

      if (patchesPacked === 0) {
        reviewsSkipped.push(`${filename} (diff too large)`);
        return;
      }

      try {
        const response = await chat(inputs.systemMessage, prompts.renderReviewFileDiff(ins), options.tokenLimits.responseTokens);
        if (response === "") {
          reviewsFailed.push(`${filename} (no response)`);
          return;
        }
        const reviews = parseReview(response, patches);
        for (const review of reviews) {
          if (!options.reviewCommentLGTM && (review.comment.includes("LGTM") || review.comment.includes("looks good to me"))) {
            lgtmCount += 1;
            continue;
          }
          reviewCount += 1;
          commenter.bufferReviewComment(filename, review.startLine, review.endLine, review.comment);
        }
      } catch (e) {
        console.warn(`[vexreview] Failed to review ${filename}:`, e);
        reviewsFailed.push(`${filename} (${e})`);
      }
    };

    let reviewedCount = 0;
    const reviewTargets = filesAndChangesReview.slice(0, options.maxFiles > 0 ? options.maxFiles : undefined);
    await Promise.all(
      reviewTargets.map(([filename, , patches]) =>
        geminiConcurrencyLimit(async () => {
          await doReview(filename, patches);
          reviewedCount++;
          progress({ stage: "reviewing", message: `Reviewing ${filename}`, filesTotal: reviewTargets.length, filesDone: reviewedCount });
        })
      )
    );

    statusMsg += `
${reviewsFailed.length > 0 ? `<details>\n<summary>Files not reviewed due to errors (${reviewsFailed.length})</summary>\n\n* ${reviewsFailed.join("\n* ")}\n</details>\n` : ""}
${reviewsSkipped.length > 0 ? `<details>\n<summary>Files skipped (${reviewsSkipped.length})</summary>\n\n* ${reviewsSkipped.join("\n* ")}\n</details>\n` : ""}
<details>
<summary>Review comments generated (${reviewCount + lgtmCount})</summary>

* Review: ${reviewCount}
* LGTM: ${lgtmCount}
</details>

---
Triggered manually from GitPlus. Reply to a review comment to continue the conversation, or add \`@vexreview: ignore\` to the PR description to pause future reviews.
`;

    summarizeComment += `\n${commenter.addReviewedCommitId(existingCommitIdsBlock, pr.head.sha)}`;

    progress({ stage: "posting", message: "Posting review to GitHub..." });
    await commenter.submitReview(prNumber, commits[commits.length - 1].sha, statusMsg, repo);
  }

  await commenter.comment(summarizeComment, SUMMARIZE_TAG, prNumber, repo);

  progress({ stage: "done", message: "Review complete." });

  return {
    status: "reviewed",
    filesReviewed: filesAndChanges.length,
    reviewCommentCount: reviewCount,
    lgtmCount,
  };
}

// ─── Pure diff-parsing helpers (verbatim port, no GH Actions dependency) ────

function splitPatch(patch: string | null | undefined): string[] {
  if (patch == null) return [];
  const pattern = /(^@@ -(\d+),(\d+) \+(\d+),(\d+) @@).*$/gm;
  const result: string[] = [];
  let last = -1;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(patch)) !== null) {
    if (last === -1) last = match.index;
    else {
      result.push(patch.substring(last, match.index));
      last = match.index;
    }
  }
  if (last !== -1) result.push(patch.substring(last));
  return result;
}

function patchStartEndLine(
  patch: string
): { oldHunk: { startLine: number; endLine: number }; newHunk: { startLine: number; endLine: number } } | null {
  const pattern = /(^@@ -(\d+),(\d+) \+(\d+),(\d+) @@)/gm;
  const match = pattern.exec(patch);
  if (match == null) return null;
  const oldBegin = parseInt(match[2]);
  const oldDiff = parseInt(match[3]);
  const newBegin = parseInt(match[4]);
  const newDiff = parseInt(match[5]);
  return {
    oldHunk: { startLine: oldBegin, endLine: oldBegin + oldDiff - 1 },
    newHunk: { startLine: newBegin, endLine: newBegin + newDiff - 1 },
  };
}

function parsePatch(patch: string): { oldHunk: string; newHunk: string } | null {
  const hunkInfo = patchStartEndLine(patch);
  if (hunkInfo == null) return null;

  const oldHunkLines: string[] = [];
  const newHunkLines: string[] = [];
  let newLine = hunkInfo.newHunk.startLine;
  const lines = patch.split("\n").slice(1);
  if (lines[lines.length - 1] === "") lines.pop();

  const skipStart = 3;
  const skipEnd = 3;
  let currentLine = 0;
  const removalOnly = !lines.some((line) => line.startsWith("+"));

  for (const line of lines) {
    currentLine++;
    if (line.startsWith("-")) {
      oldHunkLines.push(`${line.substring(1)}`);
    } else if (line.startsWith("+")) {
      newHunkLines.push(`${newLine}: ${line.substring(1)}`);
      newLine++;
    } else {
      oldHunkLines.push(`${line}`);
      if (removalOnly || (currentLine > skipStart && currentLine <= lines.length - skipEnd)) {
        newHunkLines.push(`${newLine}: ${line}`);
      } else {
        newHunkLines.push(`${line}`);
      }
      newLine++;
    }
  }

  return { oldHunk: oldHunkLines.join("\n"), newHunk: newHunkLines.join("\n") };
}

interface ParsedReview {
  startLine: number;
  endLine: number;
  comment: string;
}

function parseReview(response: string, patches: Array<[number, number, string]>): ParsedReview[] {
  const reviews: ParsedReview[] = [];
  response = sanitizeResponse(response.trim());

  const lines = response.split("\n");
  const lineNumberRangeRegex = /(?:^|\s)(\d+)-(\d+):\s*$/;
  const commentSeparator = "---";

  let currentStartLine: number | null = null;
  let currentEndLine: number | null = null;
  let currentComment = "";

  function storeReview(): void {
    if (currentStartLine === null || currentEndLine === null) return;
    const review: ParsedReview = { startLine: currentStartLine, endLine: currentEndLine, comment: currentComment };

    let withinPatch = false;
    let bestPatchStartLine = -1;
    let bestPatchEndLine = -1;
    let maxIntersection = 0;

    for (const [startLine, endLine] of patches) {
      const intersectionStart = Math.max(review.startLine, startLine);
      const intersectionEnd = Math.min(review.endLine, endLine);
      const intersectionLength = Math.max(0, intersectionEnd - intersectionStart + 1);
      if (intersectionLength > maxIntersection) {
        maxIntersection = intersectionLength;
        bestPatchStartLine = startLine;
        bestPatchEndLine = endLine;
        withinPatch = intersectionLength === review.endLine - review.startLine + 1;
      }
      if (withinPatch) break;
    }

    if (!withinPatch) {
      if (bestPatchStartLine !== -1) {
        review.comment = `> Note: mapped from original lines [${review.startLine}-${review.endLine}]\n\n${review.comment}`;
        review.startLine = bestPatchStartLine;
        review.endLine = bestPatchEndLine;
      } else if (patches.length > 0) {
        review.comment = `> Note: mapped from original lines [${review.startLine}-${review.endLine}]\n\n${review.comment}`;
        review.startLine = patches[0][0];
        review.endLine = patches[0][1];
      }
    }

    reviews.push(review);
  }

  function sanitizeCodeBlock(comment: string, codeBlockLabel: string): string {
    const codeBlockStart = `\`\`\`${codeBlockLabel}`;
    const codeBlockEnd = "```";
    const lineNumberRegex = /^ *(\d+): /gm;
    let codeBlockStartIndex = comment.indexOf(codeBlockStart);
    while (codeBlockStartIndex !== -1) {
      const codeBlockEndIndex = comment.indexOf(codeBlockEnd, codeBlockStartIndex + codeBlockStart.length);
      if (codeBlockEndIndex === -1) break;
      const codeBlock = comment.substring(codeBlockStartIndex + codeBlockStart.length, codeBlockEndIndex);
      const sanitizedBlock = codeBlock.replace(lineNumberRegex, "");
      comment =
        comment.slice(0, codeBlockStartIndex + codeBlockStart.length) + sanitizedBlock + comment.slice(codeBlockEndIndex);
      codeBlockStartIndex = comment.indexOf(
        codeBlockStart,
        codeBlockStartIndex + codeBlockStart.length + sanitizedBlock.length + codeBlockEnd.length
      );
    }
    return comment;
  }

  function sanitizeResponse(comment: string): string {
    comment = sanitizeCodeBlock(comment, "suggestion");
    comment = sanitizeCodeBlock(comment, "diff");
    return comment;
  }

  for (const line of lines) {
    const lineNumberRangeMatch = line.match(lineNumberRangeRegex);
    if (lineNumberRangeMatch != null) {
      storeReview();
      currentStartLine = parseInt(lineNumberRangeMatch[1], 10);
      currentEndLine = parseInt(lineNumberRangeMatch[2], 10);
      currentComment = "";
      continue;
    }
    if (line.trim() === commentSeparator) {
      storeReview();
      currentStartLine = null;
      currentEndLine = null;
      currentComment = "";
      continue;
    }
    if (currentStartLine !== null && currentEndLine !== null) {
      currentComment += `${line}\n`;
    }
  }
  storeReview();

  return reviews;
}
