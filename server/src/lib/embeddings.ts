/**
 * Embeddings Helper
 * Wraps the configured embedding provider (OpenAI by default, Gemini when
 * EMBEDDING_PROVIDER=gemini) — see ./models.ts for the explicit configuration.
 * The default is OpenAI text-embedding-3-large, truncated to 1024 dimensions
 * via the native `dimensions` param — large-model retrieval quality at roughly
 * the storage/cost of a mid-size model (full text-embedding-3-large is 3072 dims).
 *
 * There is deliberately NO fallback between embedding providers: vectors from
 * different models live in incompatible vector spaces, so a transient network
 * blip (ECONNRESET etc., which does happen against OpenAI) gets retried with
 * backoff instead of silently swapping models. A single uncaught throw here
 * used to abort everything downstream (Pinecone upsert, Postgres mirror, the
 * IndexedRepo association) with no partial-failure recovery.
 *
 * Consistency contract: every vector written at ingest time is tagged with its
 * { provider, model, dimensions } (Pinecone metadata + Postgres Node mirror),
 * and query time verifies stored vectors match the currently configured model
 * via assertEmbeddingConsistency(). A mismatch — including legacy vectors that
 * predate this tagging (e.g. anything previously embedded with Gemini while
 * queries now embed with OpenAI) — throws a clear error directing the operator
 * to re-ingest the repository instead of returning meaningless neighbours.
 */

import OpenAI from "openai";
import {
  DEFAULT_EMBEDDING_DIMENSIONS,
  DEFAULT_EMBEDDING_PROVIDER,
  DEFAULT_OPENAI_EMBEDDING_MODEL,
  describeEmbedding,
  getEmbeddingConfig,
  type EmbeddingConfig,
} from "./models.js";

// Import-time snapshots of the defaults, kept for backwards compatibility.
// Use getEmbeddingConfig() for the live, env-resolved configuration.
export const EMBEDDING_PROVIDER = DEFAULT_EMBEDDING_PROVIDER;
export const EMBEDDING_MODEL = DEFAULT_OPENAI_EMBEDDING_MODEL;
export const EMBEDDING_DIMENSIONS = DEFAULT_EMBEDDING_DIMENSIONS;

export type { EmbeddingConfig };
export { describeEmbedding, getEmbeddingConfig };

let openaiClient: { key: string | undefined; client: OpenAI } | undefined;

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!openaiClient || openaiClient.key !== apiKey) {
    openaiClient = { key: apiKey, client: new OpenAI({ apiKey }) };
  }
  return openaiClient.client;
}

function requireKey(provider: EmbeddingConfig["provider"]): void {
  if (provider === "gemini" && !process.env.GOOGLE_GEMINI_API_KEY?.trim()) {
    throw new Error(
      "[embeddings] GOOGLE_GEMINI_API_KEY is missing for EMBEDDING_PROVIDER=gemini. " +
        "Set GOOGLE_GEMINI_API_KEY or switch to EMBEDDING_PROVIDER=openai with OPENAI_API_KEY."
    );
  }
  if (provider === "openai" && !process.env.OPENAI_API_KEY?.trim()) {
    throw new Error(
      "[embeddings] OPENAI_API_KEY is missing for EMBEDDING_PROVIDER=openai. " +
        "Set OPENAI_API_KEY or switch to EMBEDDING_PROVIDER=gemini with GOOGLE_GEMINI_API_KEY."
    );
  }
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

function isRetryable(err: any): boolean {
  const code = err?.cause?.code || err?.code;
  if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "EAI_AGAIN") return true;
  const status = err?.status;
  return status === 429 || (typeof status === "number" && status >= 500);
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === MAX_RETRIES - 1) throw err;
      const delay = BASE_DELAY_MS * 2 ** attempt;
      console.warn(`[embeddings] ${label} failed (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delay}ms:`, err);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
}

function validateEmbeddings(vectors: unknown, count: number, config: EmbeddingConfig): number[][] {
  if (!Array.isArray(vectors) || vectors.length !== count) {
    throw new Error(
      `[embeddings] ${config.provider} returned an invalid embedding count: expected ${count}, ` +
        `received ${Array.isArray(vectors) ? vectors.length : "no embedding array"}.`
    );
  }
  for (const vector of vectors) {
    if (!Array.isArray(vector)) {
      throw new Error(`[embeddings] ${config.provider} returned an invalid embedding vector.`);
    }
    if (vector.length !== config.dimensions) {
      throw new Error(
        `[embeddings] ${config.provider} embedding dimension mismatch: expected ${config.dimensions}, ` +
          `received ${vector.length}. Check the embedding model and its output dimensionality.`
      );
    }
    if (vector.some((value: unknown) => typeof value !== "number" || !Number.isFinite(value))) {
      throw new Error(`[embeddings] ${config.provider} returned an embedding with non-finite or non-numeric values.`);
    }
  }
  return vectors as number[][];
}

async function generateGeminiEmbeddings(texts: string[], config: EmbeddingConfig): Promise<number[][]> {
  const model = config.model.replace(/^models\//, "");
  return withRetry(async () => {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:batchEmbedContents`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GOOGLE_GEMINI_API_KEY!,
        },
        body: JSON.stringify({
          requests: texts.map((text) => ({
            model: `models/${model}`,
            content: { parts: [{ text }] },
            outputDimensionality: config.dimensions,
          })),
        }),
      }
    );
    if (!response.ok) {
      throw Object.assign(
        new Error(`[embeddings] Gemini embedding request failed (HTTP ${response.status}).`),
        { status: response.status }
      );
    }
    const data = await response.json() as { embeddings?: Array<{ values?: unknown }> };
    const vectors = Array.isArray(data?.embeddings) ? data.embeddings.map((item) => item?.values) : undefined;
    return validateEmbeddings(vectors, texts.length, config);
  }, "generateGeminiEmbeddings");
}

/**
 * Generate a single embedding vector (used for query-time search)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const config = getEmbeddingConfig();
  requireKey(config.provider);
  const input = text.slice(0, 8000);
  if (config.provider === "gemini") {
    return (await generateGeminiEmbeddings([input], config))[0];
  }
  const response = await withRetry(
    () =>
      getOpenAIClient().embeddings.create({
        model: config.model,
        dimensions: config.dimensions,
        input,
      }),
    `generateEmbedding(${config.provider})`
  );
  return validateEmbeddings(response.data.map((item) => item.embedding), 1, config)[0];
}

/**
 * Generate embeddings in batches (used for repository ingestion, 100 texts/batch)
 */
export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<number[][]> {
  const config = getEmbeddingConfig();
  requireKey(config.provider);
  const BATCH_SIZE = 100;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE).map((t) => t.slice(0, 8000));
    if (config.provider === "gemini") {
      results.push(...await generateGeminiEmbeddings(batch, config));
      continue;
    }
    const response = await withRetry(
      () =>
        getOpenAIClient().embeddings.create({
          model: config.model,
          dimensions: config.dimensions,
          input: batch,
        }),
      `generateEmbeddingsBatch(${config.provider})[${i}-${i + batch.length}]`
    );
    results.push(...validateEmbeddings(response.data.map((item) => item.embedding), batch.length, config));
  }

  return results;
}

/** Minimal structural view of a stored vector's embedding origin tags. */
export interface StoredEmbeddingTags {
  embeddingProvider?: unknown;
  embeddingModel?: unknown;
  embeddingDimensions?: unknown;
}

function readTags(payload: StoredEmbeddingTags | null | undefined): EmbeddingConfig | undefined {
  if (!payload) return undefined;
  const { embeddingProvider, embeddingModel, embeddingDimensions } = payload;
  if (
    typeof embeddingProvider !== "string" ||
    typeof embeddingModel !== "string" ||
    typeof embeddingDimensions !== "number"
  ) {
    return undefined;
  }
  return {
    provider: embeddingProvider as EmbeddingConfig["provider"],
    model: embeddingModel,
    dimensions: embeddingDimensions,
  };
}

function sameConfig(a: EmbeddingConfig, b: EmbeddingConfig): boolean {
  return a.provider === b.provider && a.model === b.model && a.dimensions === b.dimensions;
}

/**
 * Verify stored vectors were embedded with the currently configured model.
 * Throws a clear, actionable error on any mismatch — including legacy vectors
 * that carry no provider/model tags (e.g. repos ingested with Gemini
 * embeddings while queries now embed with OpenAI) — instead of returning
 * meaningless cross-model neighbours. Such repositories must be re-ingested.
 */
export function assertEmbeddingConsistency(
  repoId: string,
  hits: Array<{ payload?: StoredEmbeddingTags | null }>,
  current: EmbeddingConfig = getEmbeddingConfig()
): void {
  if (hits.length === 0) return;
  const expected = describeEmbedding(current);
  const legacy = hits.filter((h) => readTags(h.payload) === undefined);
  const mismatched = new Map<string, number>();
  for (const hit of hits) {
    const stored = readTags(hit.payload);
    if (stored && !sameConfig(stored, current)) {
      const label = describeEmbedding(stored);
      mismatched.set(label, (mismatched.get(label) ?? 0) + 1);
    }
  }
  if (legacy.length === 0 && mismatched.size === 0) return;

  const parts: string[] = [];
  for (const [label, count] of mismatched) {
    parts.push(
      `${count} stored vector(s) use ${JSON.stringify(label)} but queries embed with ${JSON.stringify(expected)}`
    );
  }
  if (legacy.length > 0) {
    parts.push(
      `${legacy.length} stored vector(s) predate embedding-model tracking (no provider/model metadata) ` +
        `and may have been generated with a different model — ` +
        `e.g. Gemini and OpenAI embeddings are mutually incompatible — ` +
        `than the current query embedding ${JSON.stringify(expected)}`
    );
  }
  throw new Error(
    `[embeddings] Embedding model mismatch for repo ${JSON.stringify(repoId)}: ${parts.join("; ")}. ` +
      `Vectors from different models live in incompatible vector spaces, so search results would be meaningless. ` +
      `Re-ingest the repository (POST /api/search/ingest) with the current EMBEDDING_* configuration before searching.`
  );
}
