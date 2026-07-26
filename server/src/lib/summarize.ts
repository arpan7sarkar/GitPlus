/**
 * Summarization Helper
 * Generates the 3 higher tiers of the hierarchy (file / module / repo) that sit
 * above symbol-level chunks. Reuses chat.ts's Gemini→OpenAI failover pattern
 * (same providers, same 60s cooldown-on-429 behavior) but non-streaming and with
 * a small max-token cap, since this runs once per file/module/repo at ingest
 * time rather than once per user message.
 */

interface ProviderConfig {
  name: string;
  url: string;
  model: string;
  getKey: () => string | undefined;
}

const PROVIDERS: ProviderConfig[] = [
  {
    name: "gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-2.0-flash",
    getKey: () => process.env.GOOGLE_GEMINI_API_KEY,
  },
  {
    name: "openai",
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
    getKey: () => process.env.OPENAI_API_KEY,
  },
];

const COOLDOWN_MS = 60_000;
const rateLimitState: Record<string, number> = {};

function isProviderAvailable(provider: ProviderConfig): boolean {
  if (!provider.getKey()) return false;
  return Date.now() >= (rateLimitState[provider.name] || 0);
}

function markRateLimited(providerName: string) {
  rateLimitState[providerName] = Date.now() + COOLDOWN_MS;
}

async function completeText(systemPrompt: string, userContent: string, maxTokens: number): Promise<string> {
  const providers = PROVIDERS.filter(isProviderAvailable);

  for (const provider of providers) {
    try {
      const res = await fetch(provider.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.getKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: provider.model,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        }),
      });

      if (res.status === 429) {
        markRateLimited(provider.name);
        continue;
      }
      if (!res.ok) {
        console.warn(`[summarize] ${provider.name} error ${res.status}, trying next provider`);
        continue;
      }

      const data = (await res.json()) as any;
      return (data.choices?.[0]?.message?.content || "").trim();
    } catch (err) {
      console.warn(`[summarize] ${provider.name} fetch exception:`, err);
      continue;
    }
  }

  return ""; // all providers unavailable — caller falls back to a non-summary embeddingText
}

/**
 * Runs `fn` over `items` with bounded concurrency (LLM calls are ordered but
 * batched, same spirit as repo.ts's file-fetch concurrency limiter).
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

const FILE_SUMMARY_SYSTEM_PROMPT = `You are a senior engineer writing a one-paragraph summary of a source file for a code search index.
Describe: (1) the file's purpose, (2) its main exported symbols, (3) its key responsibilities.
Be concrete and specific — mention actual function/class names. 2-4 sentences. No markdown, no preamble.`;

export async function summarizeFile(filePath: string, content: string, symbolNames: string[]): Promise<string> {
  const truncated = content.slice(0, 6000);
  const userContent = `File: ${filePath}\nExported/top-level symbols: ${symbolNames.join(", ") || "(none detected)"}\n\n${truncated}`;
  const summary = await completeText(FILE_SUMMARY_SYSTEM_PROMPT, userContent, 150);
  return summary || `File ${filePath} (${symbolNames.slice(0, 8).join(", ") || "no top-level symbols detected"}).`;
}

const MODULE_SUMMARY_SYSTEM_PROMPT = `You are a senior engineer writing a one-paragraph summary of a module/folder for a code search index, given summaries of the files inside it.
Describe the module's overall responsibility and how its files relate to each other. 2-4 sentences. No markdown, no preamble.`;

export async function summarizeModule(modulePath: string, fileSummaries: { path: string; summary: string }[]): Promise<string> {
  const userContent = `Module: ${modulePath}\n\n${fileSummaries.map((f) => `- ${f.path}: ${f.summary}`).join("\n")}`;
  const summary = await completeText(MODULE_SUMMARY_SYSTEM_PROMPT, userContent, 180);
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
  const summary = await completeText(REPO_SUMMARY_SYSTEM_PROMPT, userContent, 220);
  return summary || `${repoMeta.name}: ${repoMeta.description || "no description available"}.`;
}
