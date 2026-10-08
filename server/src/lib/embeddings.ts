/**
 * Embeddings Helper
 * Unlike summarize.ts, there's no fallback provider here — Pinecone's vector space
 * has to stay consistent, so a transient network blip (ECONNRESET etc., which
 * does happen against OpenAI) gets retried with backoff instead of failing the
 * whole ingest outright. A single uncaught throw here used to abort everything
 * downstream (Pinecone upsert, Postgres mirror, the IndexedRepo association) with
 * no partial-failure recovery.
 */

import OpenAI from "openai";
import {
  getEmbeddingDimensions,
  getEmbeddingProvider,
  getGeminiEmbeddingModel,
  getOpenAIEmbeddingModel,
} from "./models.js";

export const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-large";
export const EMBEDDING_DIMENSIONS = getEmbeddingDimensions();

let openaiClient: OpenAI | undefined;
let geminiClient: OpenAI | undefined;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

function getGeminiClient(): OpenAI {
  if (!geminiClient) {
    geminiClient = new OpenAI({
      apiKey: process.env.GOOGLE_GEMINI_API_KEY,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    });
  }
  return geminiClient;
}

function requireKey(provider: "openai" | "gemini"): void {
  if (provider === "openai" && !process.env.OPENAI_API_KEY?.trim()) {
    throw new Error(
      "[embeddings] OPENAI_API_KEY is missing and EMBEDDING_PROVIDER=openai was forced. " +
        "Set OPENAI_API_KEY or use EMBEDDING_PROVIDER=gemini with GOOGLE_GEMINI_API_KEY."
    );
  }
  if (provider === "gemini" && !process.env.GOOGLE_GEMINI_API_KEY?.trim()) {
    throw new Error(
      "[embeddings] No embedding key available. Set OPENAI_API_KEY or GOOGLE_GEMINI_API_KEY."
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

/**
 * Generate a single embedding vector (used for query-time search)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const provider = getEmbeddingProvider();
  requireKey(provider);
  const dimensions = getEmbeddingDimensions();

  if (provider === "gemini") {
    const model = getGeminiEmbeddingModel();
    const response = await withRetry(
      () =>
        getGeminiClient().embeddings.create({
          model,
          dimensions,
          input: text.slice(0, 8000),
        } as any),
      "generateEmbedding(gemini)"
    );
    return response.data[0].embedding;
  }

  const model = getOpenAIEmbeddingModel();
  const response = await withRetry(
    () =>
      getOpenAIClient().embeddings.create({
        model,
        dimensions,
        input: text.slice(0, 8000),
      }),
    "generateEmbedding(openai)"
  );
  return response.data[0].embedding;
}

/**
 * Generate embeddings in batches (used for repository ingestion, 100 texts/batch)
 */
export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<number[][]> {
  const provider = getEmbeddingProvider();
  requireKey(provider);
  const dimensions = getEmbeddingDimensions();
  const BATCH_SIZE = 100;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE).map((t) => t.slice(0, 8000));
    if (provider === "gemini") {
      const model = getGeminiEmbeddingModel();
      const response = await withRetry(
        () =>
          getGeminiClient().embeddings.create({
            model,
            dimensions,
            input: batch,
          } as any),
        `generateEmbeddingsBatch(gemini)[${i}-${i + batch.length}]`
      );
      results.push(...response.data.map((d) => d.embedding));
    } else {
      const model = getOpenAIEmbeddingModel();
      const response = await withRetry(
        () =>
          getOpenAIClient().embeddings.create({
            model,
            dimensions,
            input: batch,
          }),
        `generateEmbeddingsBatch(openai)[${i}-${i + batch.length}]`
      );
      results.push(...response.data.map((d) => d.embedding));
    }
  }

  return results;
}
