/**
 * Shared LLM Completion Helper
 * Single provider-failover primitive used by every non-streaming LLM caller on
 * the server (ingest summarization, VexReview PR review). Tries Gemini 2.0 Flash
 * first, falls back to OpenAI GPT-4o-mini, and puts a provider in a 60s cooldown
 * after a 429 so a rate-limited provider isn't hammered by every subsequent call.
 *
 * Uses Gemini's OpenAI-compatible endpoint so both providers share one request
 * shape — same approach chat.ts uses for streaming.
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

export interface CompleteOptions {
  systemPrompt: string;
  userContent: string;
  maxTokens: number;
  temperature?: number;
  /** Log-prefix so failures are attributable to the calling subsystem. */
  label?: string;
}

/**
 * Returns the completion text, or "" if every provider is unavailable/failing.
 * Never throws — callers are expected to degrade gracefully on an empty string.
 */
export async function completeText(opts: CompleteOptions): Promise<string> {
  const { systemPrompt, userContent, maxTokens, temperature, label = "llm" } = opts;
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
          ...(temperature !== undefined ? { temperature } : {}),
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
        console.warn(`[${label}] ${provider.name} error ${res.status}, trying next provider`);
        continue;
      }

      const data = (await res.json()) as any;
      return (data.choices?.[0]?.message?.content || "").trim();
    } catch (err) {
      console.warn(`[${label}] ${provider.name} fetch exception:`, err);
      continue;
    }
  }

  return "";
}

/**
 * Runs `fn` over `items` with bounded concurrency.
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
