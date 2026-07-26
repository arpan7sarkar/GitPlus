/**
 * Actian VectorAI DB Client Wrapper
 *
 * Uses @actian/vectorai-client SDK (gRPC port 6574, REST port 50051)
 *
 * Collection schema:
 *   - Collection: gitplus_code_chunks
 *   - Dimension: 1536 (OpenAI text-embedding-3-small)
 *   - Distance Metric: COSINE
 */

import { VectorAIClient } from "@actian/vectorai-client";

const COLLECTION = "gitplus_code_chunks";
const DIMENSION = 1536;

const vectorHost = process.env.ACTIAN_VECTOR_HOST || "localhost";
const vectorPort = parseInt(process.env.ACTIAN_VECTOR_PORT || "6574", 10);
const REST_URL = process.env.ACTIAN_VECTOR_REST_URL || "http://localhost:50051";

// SDK singleton
export const actianClient = new VectorAIClient(`${vectorHost}:${vectorPort}`, {
  restUrl: REST_URL,
});

export interface CodeChunkPoint {
  id: string;
  vector: number[];
  payload: {
    repoId: string;
    filePath: string;
    codeSnippet: string;
    language: string;
    category: string;
    symbolType: string;
    startLine: number;
    endLine: number;
    lineRange: string;
  };
}

export interface SearchHit {
  id: string;
  score: number;
  payload: CodeChunkPoint["payload"];
}

/**
 * Ensures the `gitplus_code_chunks` collection exists on server startup.
 */
export async function ensureCollection(): Promise<void> {
  try {
    const collections = await actianClient.collections.list();
    const exists = (collections as any[]).some(
      (c: { name: string }) => c.name === COLLECTION
    );

    if (!exists) {
      await actianClient.collections.create(COLLECTION, {
        dimension: DIMENSION,
        distanceMetric: "COSINE",
      });
      console.log(`[actian] ✓ Collection "${COLLECTION}" created (dim=${DIMENSION})`);
    } else {
      console.log(`[actian] ✓ Collection "${COLLECTION}" ready`);
    }
  } catch (err: any) {
    if (
      err?.code === 101 ||
      err?.name === "CollectionExistsError" ||
      (err?.message && err.message.includes("already exists"))
    ) {
      console.log(`[actian] ✓ Collection "${COLLECTION}" ready`);
      return;
    }
    console.error("[actian] ensureCollection error:", err);
  }
}

/**
 * Upsert chunks in batches (max 500 per batch per Actian recommendation).
 */
export async function upsertChunks(points: CodeChunkPoint[]): Promise<void> {
  if (points.length === 0) return;

  const BATCH_SIZE = 500;
  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE);
    await actianClient.points.upsert(
      COLLECTION,
      batch.map((p) => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload,
      })),
      { wait: true } as any
    );
  }
}

/**
 * Perform vector similarity search with optional payload filter.
 */
export async function vectorSearch(
  queryVector: number[],
  filter?: Record<string, string>,
  limit = 10
): Promise<SearchHit[]> {
  const searchOptions: Record<string, unknown> = {
    limit,
    with_payload: true,
  };

  // Actian VectorAI filter DSL
  if (filter && Object.keys(filter).length > 0) {
    searchOptions.filter = {
      must: Object.entries(filter).map(([key, value]) => ({
        key: `payload.${key}`,
        match: { value },
      })),
    };
  }

  const results = await actianClient.points.search(
    COLLECTION,
    queryVector,
    searchOptions as any
  );

  return (results as any[]).map((r) => ({
    id: String(r.id),
    score: r.score as number,
    payload: r.payload as CodeChunkPoint["payload"],
  }));
}

/**
 * Deletes points associated with a specific repoId using REST fallback filter-delete.
 */
export async function deleteByRepo(repoId: string): Promise<void> {
  try {
    const res = await fetch(
      `${REST_URL}/v1/collections/${COLLECTION}/points/delete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filter: {
            must: [{ key: "payload.repoId", match: { value: repoId } }],
          },
        }),
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[actian] deleteByRepo response: ${res.status} ${text.slice(0, 200)}`);
    }
  } catch (err) {
    console.warn("[actian] deleteByRepo network error:", err);
  }
}

/**
 * Returns total count of points stored in the collection.
 */
export async function countPoints(): Promise<number> {
  try {
    return await actianClient.points.count(COLLECTION);
  } catch {
    return -1;
  }
}
