/**
 * Tree-sitter Grammar Loader
 * Wraps web-tree-sitter (WASM — no native build step) so the chunker can parse
 * real syntax trees instead of guessing chunk boundaries with regex/line counts.
 *
 * Grammars come from the `tree-sitter-wasms` package (prebuilt .wasm files),
 * loaded lazily and cached per language on first use.
 */

import { createRequire } from "module";
import path from "path";
import Parser from "web-tree-sitter";

// web-tree-sitter@0.20.x ships its Language/SyntaxNode types nested under the
// default-exported Parser namespace (CJS `export = Parser`), not as named exports.
type Language = Parser.Language;
export type TSNode = Parser.SyntaxNode;

const require = createRequire(import.meta.url);

// Maps our internal `language` id (see EXT_TO_LANG in chunker.ts) to the
// tree-sitter-wasms grammar filename that supports it.
const LANGUAGE_TO_GRAMMAR: Record<string, string> = {
  typescript: "typescript",
  tsx: "tsx",
  javascript: "javascript",
  python: "python",
  go: "go",
  rust: "rust",
  java: "java",
  ruby: "ruby",
};

let initPromise: Promise<void> | null = null;
const languageCache = new Map<string, Language | null>();
// Some prebuilt grammars (e.g. ones with external scanners, like Ruby) can load fine
// but crash on parser.parse() due to a WASM ABI mismatch. Once that happens for a
// language, stop retrying it for the rest of the process and fall back to the
// boundary-snapped chunker instead of re-crashing on every file.
const brokenAtParseTime = new Set<string>();

function grammarWasmPath(grammarName: string): string {
  const wasmsPkgDir = path.dirname(require.resolve("tree-sitter-wasms/package.json"));
  return path.join(wasmsPkgDir, "out", `tree-sitter-${grammarName}.wasm`);
}

async function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = Parser.init();
  }
  await initPromise;
}

/**
 * Returns a ready-to-use Language for the given internal language id, or null
 * if there's no tree-sitter grammar for it (caller should fall back to the
 * boundary-snapped fixed-window chunker).
 */
export async function loadLanguage(language: string): Promise<Language | null> {
  const grammarName = LANGUAGE_TO_GRAMMAR[language];
  if (!grammarName) return null;

  if (languageCache.has(language)) return languageCache.get(language)!;

  await ensureInit();
  try {
    const lang = await Parser.Language.load(grammarWasmPath(grammarName));
    languageCache.set(language, lang);
    return lang;
  } catch (err) {
    console.error(`[treeSitter] Failed to load grammar for "${language}":`, err);
    languageCache.set(language, null);
    return null;
  }
}

/**
 * Parses source text for the given internal language id.
 * Returns null if the language has no grammar or the source failed to parse.
 */
export async function parseSource(language: string, source: string): Promise<TSNode | null> {
  if (brokenAtParseTime.has(language)) return null;

  const lang = await loadLanguage(language);
  if (!lang) return null;

  try {
    const parser = new Parser();
    parser.setLanguage(lang);
    const tree = parser.parse(source);
    return tree.rootNode;
  } catch (err) {
    console.error(`[treeSitter] "${language}" grammar failed at parse time, disabling for this run:`, err);
    brokenAtParseTime.add(language);
    return null;
  }
}

export function hasGrammar(language: string): boolean {
  return language in LANGUAGE_TO_GRAMMAR;
}
