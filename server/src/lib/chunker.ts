/**
 * Code Chunker
 * Symbol-aware chunking: one chunk = one semantic symbol (function/class/method/
 * interface/enum/type), extracted from a real tree-sitter AST — never split mid-body.
 *
 * Rules:
 *   - TS/TSX/JS, Python, Go, Rust, Java: AST symbol extraction (symbolExtractor.ts).
 *     A class/impl block that fits under MAX_CHUNK_LINES is kept as one chunk;
 *     an oversized one is decomposed into its individual methods instead (never
 *     arbitrarily split mid-class or mid-method).
 *   - Any other file (JSON/YAML/MD/CSS/SQL/etc., or a language whose grammar
 *     failed to load/parse, e.g. Ruby's known WASM ABI issue): boundary-snapped
 *     fixed-window fallback — same sliding window as before, but the cut point
 *     is nudged to the nearest blank line/closing brace within a small window
 *     instead of a hard line count.
 *   - Every file also produces one `file`-level node holding its full raw
 *     content, which symbol chunks link to via parentId (module/repo-level
 *     nodes are synthesized later, in search.ts, from cross-file summaries).
 *   - Chunk `id` format: "${repoId}::${filePath}:${startLine}-${endLine}"
 *     File node `id` format: "${repoId}::${filePath}::file"
 */

import { createHash } from "crypto";
import { parseSource, hasGrammar } from "./treeSitter.js";
import { extractSymbols, type ExtractedSymbol, type SymbolType } from "./symbolExtractor.js";

export type NodeCategory = "auth" | "database" | "ai" | "routing" | "utility" | "ui";

export interface FileNode {
  id: string;
  repoId: string;
  filePath: string;
  content: string;
  language: string;
}

export interface SymbolChunk {
  id: string;
  repoId: string;
  filePath: string;
  parentId: string;
  symbolName: string;
  parentSymbolPath: string | null;
  code: string;
  embeddingText: string;
  startLine: number;
  endLine: number;
  language: string;
  symbolType: SymbolType | "config";
  category: NodeCategory;
  contentHash: string;
}

export interface ChunkResult {
  fileNodes: FileNode[];
  symbolChunks: SymbolChunk[];
}

const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", jsx: "javascript",
  py: "python", go: "go", rs: "rust", java: "java", rb: "ruby",
  sql: "sql", md: "markdown", json: "json", yaml: "yaml", toml: "toml",
  css: "css", html: "html", prisma: "prisma", graphql: "graphql",
  vue: "vue", svelte: "svelte", scss: "css",
};

const MAX_CHUNK_LINES = 120;
const MIN_SNIPPET_LENGTH = 20;
const FALLBACK_CHUNK_SIZE = 40;
const FALLBACK_STEP = 30; // 10-line overlap
const BOUNDARY_SNAP_DRIFT = 8;

function detectCategory(text: string): NodeCategory {
  const lower = text.toLowerCase();
  if (/auth|token|jwt|login|session|password|clerk|bearer/.test(lower)) return "auth";
  if (/select|insert|update|delete|prisma|table|migration|schema|from\s/.test(lower)) return "database";
  if (/gemini|openai|llm|embedding|chat|ai\.|completion|stream/.test(lower)) return "ai";
  if (/router|endpoint|route|express|post\(|get\(|app\./.test(lower)) return "routing";
  if (/component|return.*jsx|react|usestate|useeffect|usememo/.test(lower)) return "ui";
  return "utility";
}

function hash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function fileNodeId(repoId: string, filePath: string): string {
  return `${repoId}::${filePath}::file`;
}

function symbolId(repoId: string, filePath: string, startLine: number, endLine: number): string {
  return `${repoId}::${filePath}:${startLine}-${endLine}`;
}

function buildEmbeddingText(filePath: string, parentSymbolPath: string | null, name: string, symbolType: string, code: string): string {
  const symbolLabel = parentSymbolPath ? `${parentSymbolPath}.${name}` : name;
  return `// File: ${filePath}\n// Symbol: ${symbolLabel} (${symbolType})\n\n${code}`;
}

function makeSymbolChunk(
  repoId: string,
  filePath: string,
  parentId: string,
  language: string,
  lines: string[],
  startLine: number,
  endLine: number,
  symbolType: SymbolType | "config",
  symbolName: string,
  parentSymbolPath: string | null
): SymbolChunk | null {
  const code = lines.slice(startLine - 1, endLine).join("\n").trim();
  if (code.length < MIN_SNIPPET_LENGTH) return null;

  const embeddingText = buildEmbeddingText(filePath, parentSymbolPath, symbolName, symbolType, code);
  return {
    id: symbolId(repoId, filePath, startLine, endLine),
    repoId,
    filePath,
    parentId,
    symbolName,
    parentSymbolPath,
    code,
    embeddingText,
    startLine,
    endLine,
    language,
    symbolType,
    category: detectCategory(embeddingText),
    contentHash: hash(code),
  };
}

// ─── Boundary-snapped fixed-window fallback ─────────────────────────────────────

function snapToBoundary(lines: string[], idx: number, maxDrift: number): number {
  const limit = Math.min(idx + maxDrift, lines.length);
  for (let i = idx; i < limit; i++) {
    const trimmed = lines[i]?.trim() ?? "";
    if (trimmed === "" || /^[}\])]/.test(trimmed)) return i + 1;
  }
  return idx;
}

function fallbackWindowChunks(
  repoId: string,
  filePath: string,
  parentId: string,
  language: string,
  lines: string[],
  rangeStart = 1,
  rangeEnd = lines.length,
  namePrefix = ""
): SymbolChunk[] {
  const chunks: SymbolChunk[] = [];
  for (let i = rangeStart - 1; i < rangeEnd; i += FALLBACK_STEP) {
    const rawEnd = Math.min(i + FALLBACK_CHUNK_SIZE, rangeEnd);
    const snappedEnd = snapToBoundary(lines, rawEnd, BOUNDARY_SNAP_DRIFT);
    const startLine = i + 1;
    const endLine = Math.min(snappedEnd, rangeEnd);
    if (endLine < startLine) continue;

    const name = namePrefix ? `${namePrefix} (${startLine}-${endLine})` : `${filePath}:${startLine}-${endLine}`;
    const chunk = makeSymbolChunk(repoId, filePath, parentId, language, lines, startLine, endLine, "config", name, null);
    if (chunk) chunks.push(chunk);

    if (endLine >= rangeEnd) break;
  }
  return chunks;
}

// ─── AST symbol chunking ─────────────────────────────────────────────────────

function symbolChunksFromExtracted(
  repoId: string,
  filePath: string,
  parentId: string,
  language: string,
  lines: string[],
  symbols: ExtractedSymbol[]
): SymbolChunk[] {
  const chunks: SymbolChunk[] = [];

  const containers = symbols.filter((s) => s.containerId && s.symbolType === "class");
  const methods = symbols.filter((s) => s.symbolType === "method");
  const standalone = symbols.filter((s) => s.symbolType !== "method" && s.symbolType !== "class");

  const emitSymbol = (s: ExtractedSymbol) => {
    const lineCount = s.endLine - s.startLine + 1;
    if (lineCount > MAX_CHUNK_LINES) {
      // Even a single symbol can be too large (e.g. a 500-line legacy function) —
      // never emit an unbounded chunk; sub-split it with the same fallback window.
      chunks.push(...fallbackWindowChunks(repoId, filePath, parentId, language, lines, s.startLine, s.endLine, s.name));
      return;
    }
    const chunk = makeSymbolChunk(repoId, filePath, parentId, language, lines, s.startLine, s.endLine, s.symbolType, s.name, s.parentSymbolPath);
    if (chunk) chunks.push(chunk);
  };

  for (const s of standalone) emitSymbol(s);

  const methodsByContainer = new Map<string, ExtractedSymbol[]>();
  for (const m of methods) {
    if (!m.containerId) continue;
    if (!methodsByContainer.has(m.containerId)) methodsByContainer.set(m.containerId, []);
    methodsByContainer.get(m.containerId)!.push(m);
  }

  for (const container of containers) {
    const lineCount = container.endLine - container.startLine + 1;
    if (lineCount <= MAX_CHUNK_LINES) {
      emitSymbol(container);
    } else {
      // Class/impl block too big to keep whole — decompose into its methods instead.
      const containerMethods = methodsByContainer.get(container.containerId!) || [];
      for (const m of containerMethods) emitSymbol(m);
    }
  }

  return chunks;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function chunkCodeFiles(
  files: { path: string; content: string }[],
  repoId: string
): Promise<ChunkResult> {
  const fileNodes: FileNode[] = [];
  const symbolChunks: SymbolChunk[] = [];

  for (const file of files) {
    const ext = file.path.split(".").pop()?.toLowerCase() || "txt";
    const language = EXT_TO_LANG[ext] || ext;
    const lines = file.content.split("\n");
    const parentId = fileNodeId(repoId, file.path);

    fileNodes.push({ id: parentId, repoId, filePath: file.path, content: file.content, language });

    let fileChunks: SymbolChunk[] | null = null;

    if (hasGrammar(language)) {
      const root = await parseSource(language, file.content);
      if (root) {
        const symbols = extractSymbols(language, root);
        if (symbols.length > 0) {
          fileChunks = symbolChunksFromExtracted(repoId, file.path, parentId, language, lines, symbols);
        }
      }
    }

    if (!fileChunks || fileChunks.length === 0) {
      fileChunks = fallbackWindowChunks(repoId, file.path, parentId, language, lines);
    }

    symbolChunks.push(...fileChunks);
  }

  return { fileNodes, symbolChunks };
}
