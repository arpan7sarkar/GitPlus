/**
 * VexReview Configuration
 * Ported from the GitHub Action's action.yml inputs + options.ts. The original
 * read everything from `@actions/core` getInput() (only present inside an Actions
 * runner); here the same knobs are plain constructor args with the action's
 * defaults preserved, so behavior matches the Action when run from our backend.
 */

import { minimatch } from "minimatch";

/**
 * Token accounting.
 *
 * The original used @dqbd/tiktoken (cl100k_base) for exact counts. We use a
 * deliberately conservative character heuristic instead: these limits only guard
 * against overflowing a ~1M-token context window, so a slight over-estimate is
 * strictly safer than pulling a WASM tokenizer into the request path. 3.5 chars
 * per token over-estimates for typical English+code (real ratio is ~4), which is
 * the direction we want to err.
 */
export function estimateTokens(input: string): number {
  return Math.ceil(input.replace(/<\|endoftext\|>/g, "").length / 3.5);
}

export class TokenLimits {
  maxTokens: number;
  requestTokens: number;
  responseTokens: number;
  knowledgeCutOff: string;

  constructor(model = "gemini-2.0-flash") {
    this.knowledgeCutOff = "2024-04-01";
    if (model.includes("pro")) {
      this.maxTokens = 1_048_576;
      this.responseTokens = 32_768;
    } else if (model.includes("gemini")) {
      this.maxTokens = 1_048_576;
      this.responseTokens = 16_384;
    } else {
      // OpenAI fallback path (gpt-4o-mini): far smaller context than Gemini.
      this.maxTokens = 128_000;
      this.responseTokens = 8_192;
    }
    this.requestTokens = this.maxTokens - this.responseTokens - 100;
  }
}

export class PathFilter {
  private readonly rules: Array<[string, boolean]>;

  constructor(rules: string[] | null = null) {
    this.rules = [];
    if (rules != null) {
      for (const rule of rules) {
        const trimmed = rule?.trim();
        if (trimmed) {
          if (trimmed.startsWith("!")) {
            this.rules.push([trimmed.substring(1).trim(), true]);
          } else {
            this.rules.push([trimmed, false]);
          }
        }
      }
    }
  }

  check(path: string): boolean {
    if (this.rules.length === 0) return true;

    let included = false;
    let excluded = false;
    let inclusionRuleExists = false;

    for (const [rule, exclude] of this.rules) {
      if (minimatch(path, rule)) {
        if (exclude) excluded = true;
        else included = true;
      }
      if (!exclude) inclusionRuleExists = true;
    }

    return (!inclusionRuleExists || included) && !excluded;
  }
}

/** Binary/generated/lockfile noise that should never be sent to the model. */
export const DEFAULT_PATH_FILTERS = `
!dist/**
!**/*.app
!**/*.bin
!**/*.bz2
!**/*.class
!**/*.db
!**/*.csv
!**/*.tsv
!**/*.dat
!**/*.dll
!**/*.dylib
!**/*.egg
!**/*.gz
!**/*.xz
!**/*.zip
!**/*.7z
!**/*.rar
!**/*.zst
!**/*.ico
!**/*.jar
!**/*.tar
!**/*.war
!**/*.lo
!**/*.log
!**/*.mp3
!**/*.wav
!**/*.mp4
!**/*.avi
!**/*.mkv
!**/*.mov
!**/*.flv
!**/*.iso
!**/*.flac
!**/*.o
!**/*.ogg
!**/*.otf
!**/*.pdf
!**/*.doc
!**/*.docx
!**/*.xls
!**/*.xlsx
!**/*.ppt
!**/*.pptx
!**/*.pkl
!**/*.pickle
!**/*.pyc
!**/*.pyd
!**/*.pyo
!**/*.pub
!**/*.pem
!**/*.so
!**/*.eot
!**/*.exe
!**/*.pb.go
!**/*.lock
!**/*.ttf
!**/*.yaml
!**/*.yml
!**/*.cfg
!**/*.toml
!**/*.ini
!**/*.mod
!**/*.sum
!**/*.work
!**/*.json
!**/*.svg
!**/*.jpeg
!**/*.jpg
!**/*.png
!**/*.gif
!**/*.bmp
!**/*.tiff
!**/*.webm
!**/*.woff
!**/*.woff2
!**/*.wasm
!**/*.snap
!**/*.parquet
!**/gen/**
!**/_gen/**
!**/generated/**
!**/@generated/**
!**/vendor/**
!**/*.min.js
!**/*.min.js.map
!**/*.min.js.css
!**/*.tfstate
!**/*.tfstate.backup
`
  .trim()
  .split("\n");

export const DEFAULT_SYSTEM_MESSAGE = `You are \`@vexreview\`, an AI code reviewer built for the GitPlus / CodebaseGPT ecosystem.
Your purpose is to act as a highly experienced software engineer and provide a thorough
review of the code hunks and suggest code snippets to improve key areas such as:
  - Logic
  - Security
  - Performance
  - Data races
  - Consistency
  - Error handling
  - Maintainability
  - Modularity
  - Complexity
  - Optimization
  - Best practices: DRY, SOLID, KISS

Do not comment on minor code style issues, missing comments/documentation. Identify and
resolve significant concerns to improve overall code quality while deliberately
disregarding minor issues.`;

export const DEFAULT_SUMMARIZE_PROMPT = `You are tasked with generating a high-quality PR review summary.

Here is the PR Title:
\`$title\`

Here is the PR Description:
\`$description\`

Review the summary of changes provided previously and provide your final response ONLY in markdown, using exactly the following four sections. Do NOT omit any section. Do NOT add any extra conversational text.

## 📝 PR Summary
A high-level summary of the overall change instead of specific files within 80 words.

## 📂 Changed Files
A markdown table of files and their changes. Group files with similar changes together into a single row to save space. Use the columns: File, Action, Description.

## 🩺 PR Health
Provide a "PR Health" score as either "Good" 🟢 or "Bad" 🔴 based on the code quality, logic, and potential issues.

## 💡 Suggestions
If the PR Health is "Bad" or there are areas for improvement, provide a concise list of actionable suggestions. If the PR Health is "Good", you can provide a unique positive comment or celebration of the good code. Ensure this is formatted as a bulleted list.

Make sure to return ONLY the above 4 markdown headers and their contents. Ensure the titles "PR Summary", "Changed Files", "PR Health", and "Suggestions" are exactly H2.`;

export const DEFAULT_RELEASE_NOTES_PROMPT = `Craft concise release notes for the pull request.
Focus on the purpose and user impact, categorizing changes as "New Feature", "Bug Fix",
"Documentation", "Refactor", "Style", "Test", "Chore", or "Revert". Provide a bullet-point list,
e.g., "- New Feature: Added search functionality to the UI". Limit your response to 50-100 words
and emphasize features visible to the end-user while omitting code-level details.`;

export interface VexReviewOptionsInit {
  maxFiles?: number;
  reviewSimpleChanges?: boolean;
  reviewCommentLGTM?: boolean;
  disableReview?: boolean;
  /**
   * Writes generated release notes into the PR *description*. Off by default
   * here (the Action defaulted it on): a web-triggered review shouldn't silently
   * rewrite the author's PR body without them opting in.
   */
  disableReleaseNotes?: boolean;
  pathFilters?: string[];
  systemMessage?: string;
  language?: string;
  concurrencyLimit?: number;
}

export class VexReviewOptions {
  maxFiles: number;
  reviewSimpleChanges: boolean;
  reviewCommentLGTM: boolean;
  disableReview: boolean;
  disableReleaseNotes: boolean;
  pathFilters: PathFilter;
  systemMessage: string;
  language: string;
  concurrencyLimit: number;
  tokenLimits: TokenLimits;

  constructor(init: VexReviewOptionsInit = {}) {
    this.maxFiles = init.maxFiles ?? 60;
    this.reviewSimpleChanges = init.reviewSimpleChanges ?? false;
    this.reviewCommentLGTM = init.reviewCommentLGTM ?? false;
    this.disableReview = init.disableReview ?? false;
    this.disableReleaseNotes = init.disableReleaseNotes ?? true;
    this.pathFilters = new PathFilter(init.pathFilters ?? DEFAULT_PATH_FILTERS);
    this.systemMessage = init.systemMessage ?? DEFAULT_SYSTEM_MESSAGE;
    this.language = init.language ?? "en-US";
    this.concurrencyLimit = init.concurrencyLimit ?? 4;
    this.tokenLimits = new TokenLimits();
  }

  checkPath(path: string): boolean {
    return this.pathFilters.check(path);
  }
}

/**
 * Files that must never be committed. Detected and reported prominently, but —
 * unlike the original Action, which auto-closed the PR — we only *report*.
 * Silently force-closing someone's PR from a dashboard button is too
 * destructive/surprising for a user-triggered action.
 */
export const SENSITIVE_PATTERNS: RegExp[] = [
  /^\.env/i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
  /\.p8$/i,
  /\.pkcs12$/i,
  /\.pfx$/i,
  /\.keystore$/i,
  /credentials\.json/i,
  /\.npmrc/i,
  /\.aws\/credentials/i,
];

export function findSensitiveFiles(filenames: string[]): string[] {
  return filenames.filter((f) => SENSITIVE_PATTERNS.some((p) => p.test(f)));
}
