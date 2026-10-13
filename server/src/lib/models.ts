/**
 * Embedding Model Configuration
 * Single source of truth for which embedding provider/model/dimensions the
 * server uses for both ingestion (embed) and query time (search).
 *
 * Deliberately explicit: there is NO automatic provider switching. An earlier
 * revision silently fell back to Gemini embeddings when OPENAI_API_KEY was
 * absent, which produced vectors in a different vector space than OpenAI
 * queries expect — semantically meaningless nearest-neighbour results with no
 * error. The provider is now chosen only via EMBEDDING_PROVIDER (default
 * "openai"); a missing key for the configured provider is a loud startup/
 * request-time error, never a silent model swap.
 *
 * Env vars:
 *   EMBEDDING_PROVIDER            "openai" (default) or "gemini"
 *   OPENAI_EMBEDDING_MODEL        default "text-embedding-3-large"
 *   GOOGLE_GEMINI_EMBEDDING_MODEL (alias: GEMINI_EMBEDDING_MODEL)
 *                                 default "gemini-embedding-001"
 *   EMBEDDING_MODEL               generic override for the active provider
 *   EMBEDDING_DIMENSIONS           default 1024 (must match the Pinecone index)
 */

export type EmbeddingProvider = "openai" | "gemini";

export const DEFAULT_EMBEDDING_PROVIDER: EmbeddingProvider = "openai";
export const DEFAULT_OPENAI_EMBEDDING_MODEL = "text-embedding-3-large";
export const DEFAULT_GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";
export const DEFAULT_EMBEDDING_DIMENSIONS = 1024;

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;
  dimensions: number;
}

/** Explicit provider selection — defaults to OpenAI, never auto-switches. */
export function getEmbeddingProvider(): EmbeddingProvider {
  const raw = process.env.EMBEDDING_PROVIDER?.trim().toLowerCase();
  if (!raw) return DEFAULT_EMBEDDING_PROVIDER;
  if (raw === "openai" || raw === "gemini") return raw;
  throw new Error(
    `[embeddings] Invalid EMBEDDING_PROVIDER=${JSON.stringify(raw)}. Expected "openai" or "gemini".`
  );
}

export function getOpenAIEmbeddingModel(): string {
  return (
    process.env.OPENAI_EMBEDDING_MODEL?.trim() ||
    process.env.EMBEDDING_MODEL?.trim() ||
    DEFAULT_OPENAI_EMBEDDING_MODEL
  );
}

export function getGeminiEmbeddingModel(): string {
  return (
    process.env.GOOGLE_GEMINI_EMBEDDING_MODEL?.trim() ||
    process.env.GEMINI_EMBEDDING_MODEL?.trim() ||
    process.env.EMBEDDING_MODEL?.trim() ||
    DEFAULT_GEMINI_EMBEDDING_MODEL
  );
}

export function getEmbeddingModel(provider: EmbeddingProvider = getEmbeddingProvider()): string {
  return provider === "gemini" ? getGeminiEmbeddingModel() : getOpenAIEmbeddingModel();
}

export function getEmbeddingDimensions(): number {
  const raw = process.env.EMBEDDING_DIMENSIONS?.trim();
  if (!raw) return DEFAULT_EMBEDDING_DIMENSIONS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(
      `[embeddings] Invalid EMBEDDING_DIMENSIONS=${JSON.stringify(raw)}. ` +
        `Expected a positive integer (the Pinecone index uses ${DEFAULT_EMBEDDING_DIMENSIONS}).`
    );
  }
  return parsed;
}

/** Live config — read at call time so env changes apply without a restart. */
export function getEmbeddingConfig(): EmbeddingConfig {
  const provider = getEmbeddingProvider();
  return { provider, model: getEmbeddingModel(provider), dimensions: getEmbeddingDimensions() };
}

/** Stable "provider/model @dims" label for logs, metadata and error messages. */
export function describeEmbedding(config: Pick<EmbeddingConfig, "provider" | "model" | "dimensions">): string {
  return `${config.provider}/${config.model} @${config.dimensions}d`;
}
