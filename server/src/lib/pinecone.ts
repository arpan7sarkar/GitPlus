import { createHash } from "node:crypto";
import {
  Pinecone,
  type Index,
  type IndexModel,
  type IndexSchemaField,
  type PineconeRecord,
  type RecordMetadata,
} from "@pinecone-database/pinecone";

const DIMENSION = 1024;
const BATCH_SIZE = 100;
// Leave headroom below Pinecone's 2 MB / 1000-record request limits.
const BATCH_BYTES = 1_900_000;

export type NodeLevel = "repo" | "module" | "file" | "symbol";

export type NodePayload = RecordMetadata & {
  repoId: string;
  level: NodeLevel;
  filePath: string;
  language: string;
  category: string;
  symbolType: string;
  startLine: number;
  endLine: number;
  lineRange: string;
  // Embedding origin tags, written at ingest time (see embeddings.ts).
  // Optional so vectors stored before model tracking still typecheck; query
  // time treats untagged records as legacy and reports a model mismatch
  // directing the operator to re-ingest instead of mixing vector spaces.
  // (A `type` intersection rather than an `interface extends`, because the
  // SDK's RecordMetadata index signature has no `undefined` member.)
  embeddingProvider?: string;
  embeddingModel?: string;
  embeddingDimensions?: number;
};

export interface NodePoint {
  id: string;
  vector: number[];
  payload: NodePayload;
}

export interface SearchHit {
  id: string;
  score: number;
  payload: NodePayload;
  vector?: number[];
}

type Connection = {
  apiKey: string;
  name: string;
  host: string;
  namespace: string;
  client: Pinecone;
  index?: Index<NodePayload>;
  validation?: Promise<void>;
};

let connection: Connection | undefined;

/** Accept console hosts with or without https:// or a trailing slash. */
function normalizeHost(value: string): string | undefined {
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    if (
      url.protocol !== "https:" || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash
    ) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

function getConnection(): Connection {
  if (connection) return connection;
  const apiKey = process.env.PINECONE_API_KEY?.trim();
  const name = process.env.PINECONE_INDEX_NAME?.trim();
  const configuredHost = process.env.PINECONE_INDEX_HOST?.trim();
  const missing = [
    !apiKey && "PINECONE_API_KEY",
    !name && "PINECONE_INDEX_NAME",
    !configuredHost && "PINECONE_INDEX_HOST",
  ].filter(Boolean);
  if (!apiKey || !name || !configuredHost) {
    throw new Error(`[pinecone] Missing configuration: ${missing.join(", ")}.`);
  }
  const host = normalizeHost(configuredHost);
  if (!host) {
    throw new Error("[pinecone] PINECONE_INDEX_HOST must be an HTTPS host without credentials, a path or query parameters.");
  }
  const namespace = process.env.PINECONE_NAMESPACE?.trim() || "gitplus";
  // Do not initialize the SDK at import time: unrelated routes need no credentials.
  try {
    connection = { apiKey, name, host, namespace, client: new Pinecone({ apiKey }) };
  } catch {
    throw requestFailure("Client initialization");
  }
  return connection;
}

// Never attach SDK errors as causes or print them: they can contain request headers.
function requestFailure(operation: string): Error {
  return new Error(`[pinecone] ${operation} failed. Check credentials, index access and connectivity.`);
}

function safeText(value: string, apiKey: string): string {
  return JSON.stringify(String(value ?? "unreported").split(apiKey).join("[redacted]").slice(0, 160));
}

function describeField(field: IndexSchemaField, apiKey: string): string {
  if (!("type" in field)) return "legacy_metadata";
  switch (field.type) {
    case "dense_vector":
      return `dense_vector(dimension=${field.dimension}, metric=${safeText(field.metric, apiKey)})`;
    case "semantic_text":
      return `semantic_text(model=${safeText(field.model, apiKey)}, dimension=${field.dimension ?? "unreported"}, metric=${safeText(field.metric ?? "unreported", apiKey)})`;
    default:
      return safeText(field.type, apiKey);
  }
}

function validateIndex(description: IndexModel, state: Connection): void {
  if (description.status?.ready !== true) {
    throw new Error(`[pinecone] Index is not ready (state=${safeText(description.status?.state ?? "unreported", state.apiKey)}). Wait for readiness and retry.`);
  }
  if (description.name !== state.name) {
    throw new Error("[pinecone] PINECONE_INDEX_NAME does not match the described index name.");
  }
  if (normalizeHost(description.host) !== state.host) {
    throw new Error("[pinecone] PINECONE_INDEX_HOST does not match the host for PINECONE_INDEX_NAME. Copy the index host from the Pinecone console.");
  }

  // Dense vectors-API indexes include _sparse_values; legacy getters can throw on other schemas.
  const fields = description.schema?.fields ?? {};
  const dense = fields._values;
  const incompatibleField = Object.entries(fields).some(([name, field]) => {
    if (!("type" in field)) return false;
    if (field.type === "semantic_text") return true;
    if (field.type === "dense_vector") return name !== "_values";
    if (field.type === "sparse_vector") return name !== "_sparse_values";
    return field.type === "string" && field.fullTextSearch != null;
  });
  if (
    !dense || !("type" in dense) || dense.type !== "dense_vector" ||
    dense.dimension !== DIMENSION || dense.metric !== "cosine" || incompatibleField
  ) {
    const summary = Object.entries(fields).slice(0, 10)
      .map(([name, field]) => `${safeText(name, state.apiKey)}=${describeField(field, state.apiKey)}`)
      .join(", ") || "missing/empty schema";
    throw new Error(
      `[pinecone] Incompatible index: expected a legacy vectors-API schema with _values dense_vector, dimension ${DIMENSION} and metric cosine; received ${summary}. ` +
      "Select or create a separate compatible dense index and set PINECONE_INDEX_NAME and PINECONE_INDEX_HOST. GitPlus does not provision indexes or switch embedding models."
    );
  }
}

/** Validate an existing index, without creating or changing any remote resources. */
export async function ensureIndex(): Promise<void> {
  const state = getConnection();
  if (!state.validation) {
    state.validation = (async () => {
      let description: IndexModel;
      try {
        description = await state.client.indexes.describe(state.name);
      } catch {
        throw requestFailure("Index validation");
      }
      validateIndex(description, state);
    })().catch((error: unknown) => {
      state.validation = undefined; // A corrected / newly ready index can be retried.
      throw error;
    });
  }
  await state.validation;
}

async function getValidatedIndex(): Promise<{ index: Index<NodePayload>; namespace: string }> {
  await ensureIndex();
  const state = getConnection();
  state.index ??= state.client.index<NodePayload>({
    name: state.name, host: state.host, namespace: state.namespace,
  });
  return { index: state.index, namespace: state.namespace };
}

/** Preserve Actian's storage IDs so repeated ingestion remains an upsert. */
function deterministicPointId(nodeId: string): string {
  const hex = createHash("sha256").update(nodeId).digest("hex").slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    "4" + hex.slice(13, 16),
    ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
}

function validateVector(vector: number[]): void {
  if (vector.length !== DIMENSION || vector.some((value) => !Number.isFinite(value))) {
    throw new Error(`[pinecone] Expected a ${DIMENSION}-dimensional vector of finite numbers.`);
  }
}

function buildFilter(filter?: Record<string, string>): object | undefined {
  const predicates = Object.entries(filter ?? {}).map(([key, value]) => ({ [key]: { $eq: value } }));
  return predicates.length ? { $and: predicates } : undefined;
}

/** Upsert at most 100 records per request, also bounded by serialized wire bytes. */
export async function upsertChunks(points: NodePoint[]): Promise<void> {
  if (points.length === 0) return;
  const { index, namespace } = await getValidatedIndex();
  const envelopeBytes = Buffer.byteLength(JSON.stringify({ vectors: [], namespace }));
  // Preflight every record before sending any batches (including oversized inputs).
  const records = points.map((point) => {
    validateVector(point.vector);
    const record: PineconeRecord<NodePayload> = {
      id: deterministicPointId(point.id),
      values: point.vector,
      metadata: { ...point.payload, nodeId: point.id },
    };
    const bytes = Buffer.byteLength(JSON.stringify(record));
    if (envelopeBytes + bytes > BATCH_BYTES) {
      throw new Error("[pinecone] A vector record exceeds the safe 2 MB upsert request budget.");
    }
    return { record, bytes };
  });

  let batch: PineconeRecord<NodePayload>[] = [];
  let batchBytes = envelopeBytes;
  async function flush(): Promise<void> {
    try {
      await index.upsert({ records: batch });
    } catch {
      throw requestFailure("Vector upsert");
    }
    batch = [];
    batchBytes = envelopeBytes;
  }
  for (const { record, bytes } of records) {
    const separatorBytes = batch.length ? 1 : 0;
    if (batch.length && (batch.length >= BATCH_SIZE || batchBytes + separatorBytes + bytes > BATCH_BYTES)) {
      await flush();
    }
    batchBytes += (batch.length ? 1 : 0) + bytes;
    batch.push(record);
  }
  if (batch.length) await flush();
}

/** includeValues retains embeddings for retrieval's MMR re-ranking. */
export async function vectorSearch(
  queryVector: number[],
  filter?: Record<string, string>,
  limit = 10,
  includeVectors = false
): Promise<SearchHit[]> {
  const { index } = await getValidatedIndex();
  validateVector(queryVector);
  const builtFilter = buildFilter(filter);
  const response = await index.query({
    vector: queryVector,
    topK: limit,
    includeMetadata: true,
    includeValues: includeVectors,
    ...(builtFilter ? { filter: builtFilter } : {}),
  }).catch(() => { throw requestFailure("Vector query"); });
  return response.matches.map((match) => {
    if (!match.metadata) {
      throw new Error("[pinecone] Query returned a record without GitPlus metadata.");
    }
    return {
      id: typeof match.metadata.nodeId === "string" ? match.metadata.nodeId : match.id,
      score: match.score ?? 0,
      payload: match.metadata,
      vector: includeVectors ? match.values : undefined,
    };
  });
}

/** Only delete matching repository records in GitPlus's configured namespace. */
export async function deleteByRepo(repoId: string): Promise<void> {
  const { index } = await getValidatedIndex();
  await index.deleteMany({ filter: buildFilter({ repoId }) })
    .catch(() => { throw requestFailure("Repository deletion"); });
}

/** Namespace count only; -1 means unavailable or incompatible, not an empty index. */
export async function countPoints(): Promise<number> {
  try {
    const { index, namespace } = await getValidatedIndex();
    const stats = await index.describeIndexStats();
    const summary = stats.namespaces?.[namespace];
    if (!summary) return 0;
    const count = summary.recordCount;
    return Number.isSafeInteger(count) && count >= 0 ? count : -1;
  } catch {
    return -1;
  }
}
