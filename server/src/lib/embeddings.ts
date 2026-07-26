/**
 * Embeddings Helper
 * Wraps OpenAI text-embedding-3-large, truncated to 1024 dimensions via OpenAI's
 * native `dimensions` param — large-model retrieval quality at roughly the storage/
 * cost of a mid-size model (full text-embedding-3-large is 3072 dims).
 *
 * Unlike summarize.ts, there's no fallback provider here — Actian's vector space
 * has to stay consistent, so a transient network blip (ECONNRESET etc., which
 * does happen against OpenAI) gets retried with backoff instead of failing the
 * whole ingest outright. A single uncaught throw here used to abort everything
 * downstream (Actian upsert, Postgres mirror, the IndexedRepo association) with
 * no partial-failure recovery.
 */

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const EMBEDDING_MODEL = "text-embedding-3-large";
export const EMBEDDING_DIMENSIONS = 1024;

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

/**
 * Generate a single embedding vector (used for query-time search)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await withRetry(
    () =>
      openai.embeddings.create({
        model: EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
        input: text.slice(0, 8000),
      }),
    "generateEmbedding"
  );
  return response.data[0].embedding;
}

/**
 * Generate embeddings in batches (used for repository ingestion, 100 texts/batch)
 */
export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<number[][]> {
  const BATCH_SIZE = 100;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE).map((t) => t.slice(0, 8000));
    const response = await withRetry(
      () =>
        openai.embeddings.create({
          model: EMBEDDING_MODEL,
          dimensions: EMBEDDING_DIMENSIONS,
          input: batch,
        }),
      `generateEmbeddingsBatch[${i}-${i + batch.length}]`
    );
    results.push(...response.data.map((d) => d.embedding));
  }

  return results;
}
