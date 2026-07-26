/**
 * Summarization Helper
 * Generates the 3 higher tiers of the hierarchy (file / module / repo) that sit
 * above symbol-level chunks. Provider failover (Gemini -> OpenAI, with 60s
 * cooldown after a 429) lives in the shared llm.ts, which chat-adjacent callers
 * like VexReview use too — this module just owns the prompts.
 */

import { completeText, mapWithConcurrency } from "./llm.js";

// Re-exported so existing importers (search.ts) keep working unchanged.
export { mapWithConcurrency };

const FILE_SUMMARY_SYSTEM_PROMPT = `You are a senior engineer writing a one-paragraph summary of a source file for a code search index.
Describe: (1) the file's purpose, (2) its main exported symbols, (3) its key responsibilities.
Be concrete and specific — mention actual function/class names. 2-4 sentences. No markdown, no preamble.`;

export async function summarizeFile(filePath: string, content: string, symbolNames: string[]): Promise<string> {
  const truncated = content.slice(0, 6000);
  const userContent = `File: ${filePath}\nExported/top-level symbols: ${symbolNames.join(", ") || "(none detected)"}\n\n${truncated}`;
  const summary = await completeText({ systemPrompt: FILE_SUMMARY_SYSTEM_PROMPT, userContent, maxTokens: 150, label: "summarize" });
  return summary || `File ${filePath} (${symbolNames.slice(0, 8).join(", ") || "no top-level symbols detected"}).`;
}

const MODULE_SUMMARY_SYSTEM_PROMPT = `You are a senior engineer writing a one-paragraph summary of a module/folder for a code search index, given summaries of the files inside it.
Describe the module's overall responsibility and how its files relate to each other. 2-4 sentences. No markdown, no preamble.`;

export async function summarizeModule(modulePath: string, fileSummaries: { path: string; summary: string }[]): Promise<string> {
  const userContent = `Module: ${modulePath}\n\n${fileSummaries.map((f) => `- ${f.path}: ${f.summary}`).join("\n")}`;
  const summary = await completeText({ systemPrompt: MODULE_SUMMARY_SYSTEM_PROMPT, userContent, maxTokens: 180, label: "summarize" });
  return summary || `Module ${modulePath} containing: ${fileSummaries.map((f) => f.path).join(", ")}.`;
}

const REPO_SUMMARY_SYSTEM_PROMPT = `You are a senior engineer writing a concise repository-level overview for a code search index, given the repo's metadata and its module summaries.
Describe what the application does, its overall architecture, and its main components. 3-5 sentences. No markdown, no preamble.`;

export async function summarizeRepo(
  repoMeta: { name: string; description?: string; language?: string },
  moduleSummaries: { path: string; summary: string }[]
): Promise<string> {
  const userContent = `Repository: ${repoMeta.name}\nDescription: ${repoMeta.description || "(none)"}\nPrimary language: ${repoMeta.language || "unknown"}\n\nModules:\n${moduleSummaries
    .map((m) => `- ${m.path}: ${m.summary}`)
    .join("\n")}`;
  const summary = await completeText({ systemPrompt: REPO_SUMMARY_SYSTEM_PROMPT, userContent, maxTokens: 220, label: "summarize" });
  return summary || `${repoMeta.name}: ${repoMeta.description || "no description available"}.`;
}
