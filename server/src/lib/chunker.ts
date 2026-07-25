/**
 * Code Chunker Helper
 * Splits source files into overlapping chunks for vector embedding & keyword indexing.
 *
 * Rules:
 *   - Chunk size: 40 lines
 *   - Step size (overlap): 30 lines (10 lines overlap)
 *   - Min snippet length: 20 chars (shorter chunks skipped)
 *   - Chunk ID format: "${repoId}::${filePath}:${startLine}-${endLine}"
 */

import { createHash } from "crypto";

export interface CodeChunk {
  id: string;
  repoId: string;
  filePath: string;
  codeSnippet: string;
  startLine: number;
  endLine: number;
  language: string;
  symbolType: "function" | "class" | "route" | "schema" | "config";
  category: "auth" | "database" | "ai" | "routing" | "utility" | "ui";
  contentHash: string;
}

const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  py: "python", go: "go", rs: "rust", java: "java", rb: "ruby",
  sql: "sql", md: "markdown", json: "json", yaml: "yaml", toml: "toml",
  css: "css", html: "html", prisma: "prisma", graphql: "graphql",
  vue: "vue", svelte: "svelte", scss: "css",
};

export function chunkCodeFiles(
  files: { path: string; content: string }[],
  repoId: string
): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const CHUNK_SIZE = 40;
  const STEP = 30; // 10-line overlap

  for (const file of files) {
    const lines = file.content.split("\n");
    const ext = file.path.split(".").pop()?.toLowerCase() || "txt";
    const language = EXT_TO_LANG[ext] || ext;

    for (let i = 0; i < lines.length; i += STEP) {
      const slice = lines.slice(i, i + CHUNK_SIZE);
      const snippet = slice.join("\n").trim();
      if (snippet.length < 20) continue;

      const lower = snippet.toLowerCase();

      // Category detection heuristic
      let category: CodeChunk["category"] = "utility";
      if (/auth|token|jwt|login|session|password|clerk|bearer/.test(lower)) {
        category = "auth";
      } else if (/select|insert|update|delete|prisma|table|migration|schema|from\s/.test(lower)) {
        category = "database";
      } else if (/gemini|openai|llm|embedding|chat|ai\.|completion|stream/.test(lower)) {
        category = "ai";
      } else if (/router|endpoint|route|express|post\(|get\(|app\./.test(lower)) {
        category = "routing";
      } else if (/component|return.*jsx|react|usestate|useeffect|usememo/.test(lower)) {
        category = "ui";
      }

      // Symbol type detection heuristic
      let symbolType: CodeChunk["symbolType"] = "config";
      if (/^(export\s+)?(async\s+)?function|const\s+\w+\s*=\s*(async\s+)?\(/.test(snippet)) {
        symbolType = "function";
      } else if (/^(export\s+)?class\s/.test(snippet)) {
        symbolType = "class";
      } else if (/router\.(get|post|put|delete|patch)|app\.(get|post)/.test(snippet)) {
        symbolType = "route";
      } else if (/CREATE TABLE|model\s+\w+\s*\{/.test(snippet)) {
        symbolType = "schema";
      }

      const startLine = i + 1;
      const endLine = i + slice.length;
      const id = `${repoId}::${file.path}:${startLine}-${endLine}`;
      const contentHash = createHash("sha256").update(snippet).digest("hex").slice(0, 16);

      chunks.push({
        id,
        repoId,
        filePath: file.path,
        codeSnippet: snippet,
        startLine,
        endLine,
        language,
        symbolType,
        category,
        contentHash,
      });
    }
  }

  return chunks;
}
