/**
 * Actian VectorAI DB Client Wrapper
 *
 * Uses @actian/vectorai-client SDK (gRPC port 6574, REST port 50051)
 *
 * Collection schema:
 *   - Collection: gitplus_nodes_v3
 *   - Dimension: 1024 (OpenAI text-embedding-3-large, truncated via `dimensions` param)
 *   - Distance Metric: COSINE
 *
 * One flat collection holds all 4 tiers of the retrieval hierarchy (repo/module/
 * file/symbol) — `level` is a filterable payload field rather than a named-vector
 * space, since every tier shares the same embedding model/dimension. Filtering by
 * `level` (e.g. "only search symbol-level chunks") is Actian's Filtered Search
 * pattern applied to the hierarchy.
 */

import { createHash } from "crypto";
import { VectorAIClient, Field, type Filter } from "@actian/vectorai-client";

const COLLECTION = "gitplus_nodes_v3";
const DIMENSION = 1024;

const vectorHost = process.env.ACTIAN_VECTOR_HOST || "localhost";
const vectorPort = parseInt(process.env.ACTIAN_VECTOR_PORT || "6574", 10);
const REST_URL = process.env.ACTIAN_VECTOR_REST_URL || "http://localhost:50051";

// SDK singleton
export const actianClient = new VectorAIClient(`${vectorHost}:${vectorPort}`, {
  restUrl: REST_URL,
});

export type NodeLevel = "repo" | "module" | "file" | "symbol";

export interface NodePayload {
  repoId: string;
  level: NodeLevel;
  filePath: string;
  language: string;
  category: string;
  symbolType: string;
  startLine: number;
  endLine: number;
  lineRange: string;
  [key: string]: unknown;
}

export interface NodePoint {
  id: string;
  vector: number[];
  payload: NodePayload;
}

export interface SearchHit {
  id: string;
  score: number;
  payload: NodePayload;
}

/**
 * Actian's server requires point IDs to be valid UUIDs — our own node IDs
 * ("repoId::path:line-line") aren't. Deterministically derive a UUID-shaped id
 * from the node id (same input always maps to the same UUID, so re-ingest
 * upserts the same point instead of duplicating it) and carry the real node id
 * in the payload (`nodeId`) so every caller downstream of vectorSearch() only
 * ever sees our own IDs — this mapping is a storage-layer-only detail.
 */
function deterministicPointId(nodeId: string): string {
  const hex = createHash("sha256").update(nodeId).digest("hex").slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    "4" + hex.slice(13, 16), // version 4
    ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20), // variant 10xx
    hex.slice(20, 32),
  ].join("-");
}

/**
 * Ensures the collection exists on server startup.
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
 * Upsert points in batches (max 500 per batch per Actian recommendation).
 */
export async function upsertChunks(points: NodePoint[]): Promise<void> {
  if (points.length === 0) return;

  const BATCH_SIZE = 500;
  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE);
    await actianClient.points.upsert(
      COLLECTION,
      batch.map((p) => ({
        id: deterministicPointId(p.id),
        vector: p.vector,
        payload: { ...p.payload, nodeId: p.id },
      })),
      { wait: true } as any
    );
  }
}

/**
 * Builds a real Filter instance from a flat key/value map — the SDK's
 * `points.search`/`points.delete` require an actual Field/Filter object
 * (with methods like `.isEmpty()`), not a plain `{must: [...]}` DSL object.
 */
function buildFilter(filter?: Record<string, string>): Filter | undefined {
  if (!filter) return undefined;
  const conditions = Object.entries(filter).map(([key, value]) => new Field(`payload.${key}`).eq(value));
  if (conditions.length === 0) return undefined;
  return conditions.length === 1 ? conditions[0] : conditions[0].and(...conditions.slice(1));
}

/**
 * Perform vector similarity search with optional payload filter
 * (repoId, level, category, language, ...).
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

  const builtFilter = buildFilter(filter);
  if (builtFilter) {
    searchOptions.filter = builtFilter;
  }

  const results = await actianClient.points.search(
    COLLECTION,
    queryVector,
    searchOptions as any
  );

  return (results as any[]).map((r) => ({
    id: String(r.payload?.nodeId ?? r.id),
    score: r.score as number,
    payload: r.payload as NodePayload,
  }));
}

/**
 * Deletes all points for a repoId via the SDK's own filter-delete method
 * (previously this bypassed the SDK entirely with a raw REST fetch).
 */
export async function deleteByRepo(repoId: string): Promise<void> {
  try {
    await actianClient.points.delete(COLLECTION, {
      filter: buildFilter({ repoId }),
      wait: true,
    } as any);
  } catch (err) {
    console.warn("[actian] deleteByRepo error:", err);
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
