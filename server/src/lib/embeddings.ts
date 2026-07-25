/**
 * Embeddings Helper
 * Wraps OpenAI text-embedding-3-small (1536 dimensions)
 */

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate a single embedding vector (used for query-time search)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
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
      model: "text-embedding-3-small",
      input: batch,
    });
    results.push(...response.data.map((d) => d.embedding));
  }

  return results;
}
