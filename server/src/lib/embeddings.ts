/**
 * Embeddings Helper
 * Wraps OpenAI text-embedding-3-large, truncated to 1024 dimensions via OpenAI's
 * native `dimensions` param — large-model retrieval quality at roughly the storage/
 * cost of a mid-size model (full text-embedding-3-large is 3072 dims).
 */

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const EMBEDDING_MODEL = "text-embedding-3-large";
export const EMBEDDING_DIMENSIONS = 1024;

/**
 * Generate a single embedding vector (used for query-time search)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    input: text.slice(0, 8000),
  });
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
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      input: batch,
    });
    results.push(...response.data.map((d) => d.embedding));
  }

  return results;
}
