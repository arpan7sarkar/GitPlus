/**
 * VexReview Commenter
 * Ported from the Action's commenter.ts. Two changes from the original:
 *   1. Uses a plain @octokit/rest client (the original used @octokit/action,
 *      which auto-reads GITHUB_TOKEN from the Actions runner env).
 *   2. `rejectPR()` is intentionally NOT ported — the Action auto-closed PRs on
 *      sensitive-file detection. Force-closing a PR from a dashboard button is
 *      too destructive; the engine reports the finding instead.
 *
 * The HTML-comment marker tags are kept byte-identical to the Action so that a
 * repo which previously used the GitHub Action keeps updating the *same* summary
 * comment rather than posting a duplicate.
 */

import type { Octokit } from "@octokit/rest";

export const COMMENT_GREETING = "🤖   VexReview";

export const COMMENT_TAG = "<!-- This is an auto-generated comment by VexReview -->";
export const COMMENT_REPLY_TAG = "<!-- This is an auto-generated reply by VexReview -->";
export const SUMMARIZE_TAG = "<!-- This is an auto-generated comment: summarize by VexReview -->";
export const IN_PROGRESS_START_TAG =
  "<!-- This is an auto-generated comment: summarize review in progress by VexReview -->";
export const IN_PROGRESS_END_TAG =
  "<!-- end of auto-generated comment: summarize review in progress by VexReview -->";
export const DESCRIPTION_START_TAG =
  "<!-- This is an auto-generated comment: release notes by VexReview -->";
export const DESCRIPTION_END_TAG =
  "<!-- end of auto-generated comment: release notes by VexReview -->";
export const RAW_SUMMARY_START_TAG = `<!-- This is an auto-generated comment: raw summary by VexReview -->
<!--
`;
export const RAW_SUMMARY_END_TAG = `-->
<!-- end of auto-generated comment: raw summary by VexReview -->`;
export const SHORT_SUMMARY_START_TAG = `<!-- This is an auto-generated comment: short summary by VexReview -->
<!--
`;
export const SHORT_SUMMARY_END_TAG = `-->
<!-- end of auto-generated comment: short summary by VexReview -->`;
export const COMMIT_ID_START_TAG = "<!-- commit_ids_reviewed_start -->";
export const COMMIT_ID_END_TAG = "<!-- commit_ids_reviewed_end -->";

export interface RepoRef {
  owner: string;
  repo: string;
}

export class Commenter {
  private readonly octokit: Octokit;
  private readonly reviewCommentsBuffer: Array<{
    path: string;
    startLine: number;
    endLine: number;
    message: string;
  }> = [];
  private reviewCommentsCache: Record<number, any[]> = {};
  private issueCommentsCache: Record<number, any[]> = {};

  constructor(octokit: Octokit) {
    this.octokit = octokit;
  }

  get bufferedCount(): number {
    return this.reviewCommentsBuffer.length;
  }

  // ─── Tag helpers ───────────────────────────────────────────────────────────

  getContentWithinTags(content: string, startTag: string, endTag: string): string {
    const start = content.indexOf(startTag);
    const end = content.indexOf(endTag);
    if (start >= 0 && end >= 0) return content.slice(start + startTag.length, end);
    return "";
  }

  removeContentWithinTags(content: string, startTag: string, endTag: string): string {
    const start = content.indexOf(startTag);
    const end = content.lastIndexOf(endTag);
    if (start >= 0 && end >= 0) return content.slice(0, start) + content.slice(end + endTag.length);
    return content;
  }

  getRawSummary(summary: string): string {
    return this.getContentWithinTags(summary, RAW_SUMMARY_START_TAG, RAW_SUMMARY_END_TAG);
  }

  getShortSummary(summary: string): string {
    return this.getContentWithinTags(summary, SHORT_SUMMARY_START_TAG, SHORT_SUMMARY_END_TAG);
  }

  getDescription(description: string): string {
    return this.removeContentWithinTags(description, DESCRIPTION_START_TAG, DESCRIPTION_END_TAG);
  }

  // ─── Issue-level comments (the summary comment) ─────────────────────────────

  async comment(message: string, tag: string, prNumber: number, repo: RepoRef): Promise<void> {
    const body = `${COMMENT_GREETING}\n\n${message}\n\n${tag || COMMENT_TAG}`;
    await this.replace(body, tag || COMMENT_TAG, prNumber, repo);
  }

  private async create(body: string, target: number, repo: RepoRef): Promise<void> {
    try {
      const response = await this.octokit.issues.createComment({
        owner: repo.owner,
        repo: repo.repo,
        issue_number: target,
        body,
      });
      if (this.issueCommentsCache[target]) this.issueCommentsCache[target].push(response.data);
      else this.issueCommentsCache[target] = [response.data];
    } catch (e) {
      console.warn("[vexreview] Failed to create comment:", e);
    }
  }

  private async replace(body: string, tag: string, target: number, repo: RepoRef): Promise<void> {
    try {
      const cmt = await this.findCommentWithTag(tag, target, repo);
      if (cmt) {
        await this.octokit.issues.updateComment({
          owner: repo.owner,
          repo: repo.repo,
          comment_id: cmt.id,
          body,
        });
      } else {
        await this.create(body, target, repo);
      }
    } catch (e) {
      console.warn("[vexreview] Failed to replace comment:", e);
    }
  }

  async findCommentWithTag(tag: string, target: number, repo: RepoRef): Promise<any | null> {
    try {
      const comments = await this.listComments(target, repo);
      for (const cmt of comments) {
        if (cmt.body && cmt.body.includes(tag)) return cmt;
      }
      return null;
    } catch (e) {
      console.warn("[vexreview] Failed to find comment with tag:", e);
      return null;
    }
  }

  async listComments(target: number, repo: RepoRef): Promise<any[]> {
    if (this.issueCommentsCache[target]) return this.issueCommentsCache[target];

    const allComments: any[] = [];
    let page = 1;
    try {
      for (;;) {
        const { data: comments } = await this.octokit.issues.listComments({
          owner: repo.owner,
          repo: repo.repo,
          issue_number: target,
          page,
          per_page: 100,
        });
        allComments.push(...comments);
        page++;
        if (!comments || comments.length < 100) break;
      }
      this.issueCommentsCache[target] = allComments;
      return allComments;
    } catch (e) {
      console.warn("[vexreview] Failed to list comments:", e);
      return allComments;
    }
  }

  // ─── PR description (release notes) ─────────────────────────────────────────

  async updateDescription(pullNumber: number, message: string, repo: RepoRef): Promise<void> {
    try {
      const pr = await this.octokit.pulls.get({
        owner: repo.owner,
        repo: repo.repo,
        pull_number: pullNumber,
      });
      const body = pr.data.body || "";
      const description = this.getDescription(body);
      const messageClean = this.removeContentWithinTags(
        message,
        DESCRIPTION_START_TAG,
        DESCRIPTION_END_TAG
      );
      const newDescription = `${description}\n${DESCRIPTION_START_TAG}\n${messageClean}\n${DESCRIPTION_END_TAG}`;
      await this.octokit.pulls.update({
        owner: repo.owner,
        repo: repo.repo,
        pull_number: pullNumber,
        body: newDescription,
      });
    } catch (e) {
      console.warn("[vexreview] Failed to update PR description:", e);
    }
  }

  // ─── Inline review comments ─────────────────────────────────────────────────

  bufferReviewComment(path: string, startLine: number, endLine: number, message: string): void {
    this.reviewCommentsBuffer.push({
      path,
      startLine,
      endLine,
      message: `${COMMENT_GREETING}\n\n${message}\n\n${COMMENT_TAG}`,
    });
  }

  private async deletePendingReview(pullNumber: number, repo: RepoRef): Promise<void> {
    try {
      const reviews = await this.octokit.pulls.listReviews({
        owner: repo.owner,
        repo: repo.repo,
        pull_number: pullNumber,
      });
      const pendingReview = reviews.data.find((review: any) => review.state === "PENDING");
      if (pendingReview) {
        try {
          await this.octokit.pulls.deletePendingReview({
            owner: repo.owner,
            repo: repo.repo,
            pull_number: pullNumber,
            review_id: pendingReview.id,
          });
        } catch (e) {
          console.warn("[vexreview] Failed to delete pending review:", e);
        }
      }
    } catch (e) {
      console.warn("[vexreview] Failed to list reviews:", e);
    }
  }

  async submitReview(
    pullNumber: number,
    commitId: string,
    statusMsg: string,
    repo: RepoRef
  ): Promise<void> {
    const body = `${COMMENT_GREETING}\n\n${statusMsg}\n`;

    if (this.reviewCommentsBuffer.length === 0) {
      try {
        await this.octokit.pulls.createReview({
          owner: repo.owner,
          repo: repo.repo,
          pull_number: pullNumber,
          commit_id: commitId,
          event: "COMMENT",
          body,
        });
      } catch (e) {
        console.warn("[vexreview] Failed to submit empty review:", e);
      }
      return;
    }

    // Remove our own previous comments at the same ranges so re-running a review
    // updates rather than stacks duplicates.
    for (const comment of this.reviewCommentsBuffer) {
      const comments = await this.getCommentsAtRange(
        pullNumber,
        comment.path,
        comment.startLine,
        comment.endLine,
        repo
      );
      for (const c of comments) {
        if (c.body.includes(COMMENT_TAG)) {
          try {
            await this.octokit.pulls.deleteReviewComment({
              owner: repo.owner,
              repo: repo.repo,
              comment_id: c.id,
            });
          } catch (e) {
            console.warn("[vexreview] Failed to delete review comment:", e);
          }
        }
      }
    }

    await this.deletePendingReview(pullNumber, repo);

    const generateCommentData = (comment: any) => {
      const commentData: any = {
        path: comment.path,
        body: comment.message,
        line: comment.endLine,
      };
      if (comment.startLine !== comment.endLine) {
        commentData.start_line = comment.startLine;
        commentData.start_side = "RIGHT";
      }
      return commentData;
    };

    try {
      const review = await this.octokit.pulls.createReview({
        owner: repo.owner,
        repo: repo.repo,
        pull_number: pullNumber,
        commit_id: commitId,
        comments: this.reviewCommentsBuffer.map(generateCommentData),
      });

      await this.octokit.pulls.submitReview({
        owner: repo.owner,
        repo: repo.repo,
        pull_number: pullNumber,
        review_id: review.data.id,
        event: "COMMENT",
        body,
      });
    } catch (e) {
      // A single bad line range fails the whole batched review — fall back to
      // posting comments individually so one bad anchor doesn't lose them all.
      console.warn("[vexreview] Batched review failed, falling back to individual comments:", e);
      await this.deletePendingReview(pullNumber, repo);
      for (const comment of this.reviewCommentsBuffer) {
        try {
          await this.octokit.pulls.createReviewComment({
            owner: repo.owner,
            repo: repo.repo,
            pull_number: pullNumber,
            commit_id: commitId,
            ...generateCommentData(comment),
          });
        } catch (ee) {
          console.warn("[vexreview] Failed to create review comment:", ee);
        }
      }
    }
  }

  async listReviewComments(target: number, repo: RepoRef): Promise<any[]> {
    if (this.reviewCommentsCache[target]) return this.reviewCommentsCache[target];

    const allComments: any[] = [];
    let page = 1;
    try {
      for (;;) {
        const { data: comments } = await this.octokit.pulls.listReviewComments({
          owner: repo.owner,
          repo: repo.repo,
          pull_number: target,
          page,
          per_page: 100,
        });
        allComments.push(...comments);
        page++;
        if (!comments || comments.length < 100) break;
      }
      this.reviewCommentsCache[target] = allComments;
      return allComments;
    } catch (e) {
      console.warn("[vexreview] Failed to list review comments:", e);
      return allComments;
    }
  }

  async getCommentsAtRange(
    pullNumber: number,
    path: string,
    startLine: number,
    endLine: number,
    repo: RepoRef
  ): Promise<any[]> {
    const comments = await this.listReviewComments(pullNumber, repo);
    return comments.filter(
      (comment: any) =>
        comment.path === path &&
        comment.body !== "" &&
        ((comment.start_line !== undefined &&
          comment.start_line === startLine &&
          comment.line === endLine) ||
          (startLine === endLine && comment.line === endLine))
    );
  }

  async getCommentsWithinRange(
    pullNumber: number,
    path: string,
    startLine: number,
    endLine: number,
    repo: RepoRef
  ): Promise<any[]> {
    const comments = await this.listReviewComments(pullNumber, repo);
    return comments.filter(
      (comment: any) =>
        comment.path === path &&
        comment.body !== "" &&
        ((comment.start_line !== undefined &&
          comment.start_line >= startLine &&
          comment.line <= endLine) ||
          (startLine === endLine && comment.line === endLine))
    );
  }

  async getCommentChainsWithinRange(
    pullNumber: number,
    path: string,
    startLine: number,
    endLine: number,
    repo: RepoRef,
    tag = ""
  ): Promise<string> {
    const existingComments = await this.getCommentsWithinRange(
      pullNumber,
      path,
      startLine,
      endLine,
      repo
    );
    const topLevelComments = existingComments.filter((c: any) => !c.in_reply_to_id);

    let allChains = "";
    let chainNum = 0;
    for (const topLevelComment of topLevelComments) {
      const chain = this.composeCommentChain(existingComments, topLevelComment);
      if (chain && chain.includes(tag)) {
        chainNum += 1;
        allChains += `Conversation Chain ${chainNum}:\n${chain}\n---\n`;
      }
    }
    return allChains;
  }

  private composeCommentChain(reviewComments: any[], topLevelComment: any): string {
    const conversationChain = reviewComments
      .filter((cmt: any) => cmt.in_reply_to_id === topLevelComment.id)
      .map((cmt: any) => `${cmt.user.login}: ${cmt.body}`);
    conversationChain.unshift(`${topLevelComment.user.login}: ${topLevelComment.body}`);
    return conversationChain.join("\n---\n");
  }

  // ─── Incremental-review commit tracking ─────────────────────────────────────

  getReviewedCommitIds(commentBody: string): string[] {
    const start = commentBody.indexOf(COMMIT_ID_START_TAG);
    const end = commentBody.indexOf(COMMIT_ID_END_TAG);
    if (start === -1 || end === -1) return [];
    const ids = commentBody.substring(start + COMMIT_ID_START_TAG.length, end);
    return ids
      .split("<!--")
      .map((id) => id.replace("-->", "").trim())
      .filter((id) => id !== "");
  }

  getReviewedCommitIdsBlock(commentBody: string): string {
    const start = commentBody.indexOf(COMMIT_ID_START_TAG);
    const end = commentBody.indexOf(COMMIT_ID_END_TAG);
    if (start === -1 || end === -1) return "";
    return commentBody.substring(start, end + COMMIT_ID_END_TAG.length);
  }

  addReviewedCommitId(commentBody: string, commitId: string): string {
    const start = commentBody.indexOf(COMMIT_ID_START_TAG);
    const end = commentBody.indexOf(COMMIT_ID_END_TAG);
    if (start === -1 || end === -1) {
      return `${commentBody}\n${COMMIT_ID_START_TAG}\n<!-- ${commitId} -->\n${COMMIT_ID_END_TAG}`;
    }
    const ids = commentBody.substring(start + COMMIT_ID_START_TAG.length, end);
    return `${commentBody.substring(
      0,
      start + COMMIT_ID_START_TAG.length
    )}${ids}<!-- ${commitId} -->\n${commentBody.substring(end)}`;
  }

  getHighestReviewedCommitId(commitIds: string[], reviewedCommitIds: string[]): string {
    for (let i = commitIds.length - 1; i >= 0; i--) {
      if (reviewedCommitIds.includes(commitIds[i])) return commitIds[i];
    }
    return "";
  }

  async getAllCommitIds(pullNumber: number, repo: RepoRef): Promise<string[]> {
    const allCommits: string[] = [];
    let page = 1;
    let commits;
    do {
      commits = await this.octokit.pulls.listCommits({
        owner: repo.owner,
        repo: repo.repo,
        pull_number: pullNumber,
        per_page: 100,
        page,
      });
      allCommits.push(...commits.data.map((commit: any) => commit.sha));
      page++;
    } while (commits.data.length > 0);
    return allCommits;
  }

  addInProgressStatus(commentBody: string, statusMsg: string): string {
    const start = commentBody.indexOf(IN_PROGRESS_START_TAG);
    const end = commentBody.indexOf(IN_PROGRESS_END_TAG);
    if (start === -1 || end === -1) {
      return `${IN_PROGRESS_START_TAG}\n\nCurrently reviewing new changes in this PR...\n\n${statusMsg}\n\n${IN_PROGRESS_END_TAG}\n\n---\n\n${commentBody}`;
    }
    return commentBody;
  }
}
