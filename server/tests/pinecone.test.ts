import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { inspect } from "node:util";
import { Pinecone } from "@pinecone-database/pinecone";
import type { NodePayload, NodePoint } from "../src/lib/pinecone.js";

const API_KEY = "offline-test-key-never-send";
const INDEX_NAME = "gitplus-test";
const INDEX_HOST = "gitplus-test.svc.example.pinecone.io";
const ENV_KEYS = ["PINECONE_API_KEY", "PINECONE_INDEX_NAME", "PINECONE_INDEX_HOST", "PINECONE_NAMESPACE"] as const;
const VECTOR = Array.from({ length: 1024 }, (_, i) => Math.PI / (i + 1));
const PAYLOAD: NodePayload = {
  repoId: "repo-1",
  level: "symbol",
  filePath: "src/example.ts",
  language: "typescript",
  category: "source",
  symbolType: "function",
  startLine: 10,
  endLine: 20,
  lineRange: "10-20",
};

type WireRecord = { id: string; values: number[]; metadata: NodePayload };
type RequestLog = {
  url: URL;
  method: string;
  body: Record<string, unknown>;
  rawBody: string;
};

function denseFields(dimension = 1024, metric = "cosine") {
  return {
    _values: { type: "dense_vector", dimension, metric },
    _sparse_values: { type: "sparse_vector" },
    repoId: { filterable: true },
  };
}

function indexDescription(fields: object = denseFields()) {
  return {
    name: INDEX_NAME,
    host: INDEX_HOST,
    status: { ready: true, state: "Ready" },
    deployment: { deployment_type: "managed", cloud: "aws", region: "us-east-1" },
    schema: { fields },
    deletion_protection: "disabled",
  };
}

let savedEnv: Record<string, string | undefined>;
let requests: RequestLog[];
let description: ReturnType<typeof indexDescription>;
let queryMatches: object[];
let stats: object;
let failures: Map<string, { status: number; message: string }>;
let importCounter = 0;

// Each module instance gets a fresh lazy singleton, without production test hooks.
async function adapter(): Promise<typeof import("../src/lib/pinecone.js")> {
  return import(new URL(`../src/lib/pinecone.ts?offline-test=${++importCounter}`, import.meta.url).href);
}

function point(id = "repo-1::src/example.ts:10-20", payload: NodePayload = PAYLOAD): NodePoint {
  return { id, vector: [...VECTOR], payload: { ...payload } };
}

function calls(path: string): RequestLog[] {
  return requests.filter((request) => request.url.pathname === path);
}

function dataCalls(): RequestLog[] {
  return requests.filter((request) => request.url.hostname !== "api.pinecone.io");
}

function assertSafeError(error: unknown, message: RegExp): boolean {
  assert.ok(error instanceof Error);
  assert.match(error.message, message);
  assert.ok(!inspect(error).includes(API_KEY), "error must not expose API keys or raw request causes");
  assert.equal(error.cause, undefined);
  return true;
}

beforeEach((t) => {
  assert.ok("mock" in t, "offline hooks require a test context");
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.PINECONE_API_KEY = API_KEY;
  process.env.PINECONE_INDEX_NAME = INDEX_NAME;
  process.env.PINECONE_INDEX_HOST = INDEX_HOST;
  delete process.env.PINECONE_NAMESPACE;
  requests = [];
  description = indexDescription();
  queryMatches = [];
  stats = { dimension: 1024, namespaces: { gitplus: { vectorCount: 7 } }, totalVectorCount: 200 };
  failures = new Map();

  // No fall-through to the real fetch: all SDK traffic stays in this process.
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const rawBody = typeof init?.body === "string" ? init.body : "";
    const request = { url, method: init?.method ?? "GET", rawBody, body: rawBody ? JSON.parse(rawBody) : {} };
    requests.push(request);
    const failure = failures.get(url.pathname);
    if (failure) return Response.json({ message: failure.message }, { status: failure.status });
    if (url.origin === "https://api.pinecone.io" && url.pathname === `/indexes/${INDEX_NAME}`) {
      assert.equal(request.method, "GET");
      return Response.json(description);
    }
    assert.equal(url.origin, `https://${INDEX_HOST}`, "unexpected SDK host; network is blocked");
    assert.equal(request.method, "POST");
    switch (url.pathname) {
      case "/vectors/upsert":
        return Response.json({ upsertedCount: (request.body.vectors as WireRecord[]).length });
      case "/query":
        return Response.json({ matches: queryMatches, namespace: request.body.namespace });
      case "/vectors/delete":
        return Response.json({});
      case "/describe_index_stats":
        return Response.json(stats);
      default:
        assert.fail(`Unexpected SDK path ${url.pathname}; network is blocked`);
    }
  });
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

test("import is lazy; missing configuration is safe and count is unavailable", async () => {
  for (const key of ENV_KEYS) delete process.env[key];
  const pc = await adapter();
  assert.equal(requests.length, 0);
  await assert.rejects(pc.ensureIndex(), (error) => {
    assertSafeError(error, /Missing configuration/);
    assert.match((error as Error).message, /PINECONE_API_KEY.*PINECONE_INDEX_NAME.*PINECONE_INDEX_HOST/);
    return true;
  });
  await assert.rejects(pc.upsertChunks([point()]), /Missing configuration/);
  await assert.rejects(pc.vectorSearch(VECTOR), /Missing configuration/);
  await assert.rejects(pc.deleteByRepo("repo-1"), /Missing configuration/);
  assert.equal(await pc.countPoints(), -1);
  assert.equal(requests.length, 0);
  // Failed initialization isn't cached, even when env is populated after import.
  process.env.PINECONE_API_KEY = API_KEY;
  process.env.PINECONE_INDEX_NAME = INDEX_NAME;
  process.env.PINECONE_INDEX_HOST = INDEX_HOST;
  await pc.ensureIndex();
});

for (const key of ENV_KEYS.slice(0, 3)) {
  test(`${key} is required even when the other configuration exists`, async () => {
    process.env[key] = " ";
    const pc = await adapter();
    await assert.rejects(pc.ensureIndex(), new RegExp(`Missing configuration: ${key}`));
    assert.equal(await pc.countPoints(), -1);
    assert.equal(requests.length, 0);
  });
}

test("invalid host configuration is rejected without any HTTP traffic", async () => {
  process.env.PINECONE_INDEX_HOST = `https://user:${API_KEY}@${INDEX_HOST}/path?api_key=${API_KEY}`;
  const pc = await adapter();
  await assert.rejects(pc.ensureIndex(), (error) => assertSafeError(error, /HTTPS host without credentials/));
  assert.equal(requests.length, 0);
});

test("valid legacy dense/sparse pair validates once and shares concurrent validation", async () => {
  process.env.PINECONE_INDEX_HOST = `https://${INDEX_HOST.toUpperCase()}/`;
  const pc = await adapter();
  await Promise.all([pc.ensureIndex(), pc.ensureIndex(), pc.ensureIndex()]);
  await pc.ensureIndex();
  assert.equal(requests.length, 1);
  assert.equal(dataCalls().length, 0);
});

test("readiness failure gates all operations and validation retries when ready", async () => {
  description.status = { ready: false, state: "Initializing" };
  const pc = await adapter();
  await assert.rejects(pc.ensureIndex(), /not ready.*Initializing/);
  await assert.rejects(pc.upsertChunks([point()]), /not ready/);
  await assert.rejects(pc.vectorSearch(VECTOR), /not ready/);
  await assert.rejects(pc.deleteByRepo("repo-1"), /not ready/);
  assert.equal(await pc.countPoints(), -1);
  assert.equal(dataCalls().length, 0);
  description = indexDescription();
  await pc.upsertChunks([point()]);
  assert.equal(calls(`/indexes/${INDEX_NAME}`).length, 6);
  assert.equal(calls("/vectors/upsert").length, 1);
});

for (const [label, fields, message] of [
  ["wrong dimension", denseFields(768), /dimension=768/],
  ["wrong metric", denseFields(1024, "dotproduct"), /metric="dotproduct"/],
  ["sparse vectors API", { _sparse_values: { type: "sparse_vector" } }, /sparse_vector/],
  ["named dense documents API", { embedding: { type: "dense_vector", dimension: 1024, metric: "cosine" } }, /embedding/],
  ["mixed reserved and named vectors", { ...denseFields(), embedding: { type: "dense_vector", dimension: 1024, metric: "cosine" } }, /embedding/],
  ["empty schema", {}, /missing\/empty schema/],
] as const) {
  test(`${label} is incompatible and cannot query, write, delete or count`, async () => {
    description = indexDescription(fields);
    const pc = await adapter();
    await assert.rejects(pc.ensureIndex(), (error) => {
      assertSafeError(error, /Incompatible index.*legacy vectors-API.*1024.*cosine/);
      assert.match((error as Error).message, message);
      return true;
    });
    await assert.rejects(pc.upsertChunks([point()]), /Incompatible index/);
    await assert.rejects(pc.vectorSearch(VECTOR), /Incompatible index/);
    await assert.rejects(pc.deleteByRepo("repo-1"), /Incompatible index/);
    assert.equal(await pc.countPoints(), -1);
    assert.equal(dataCalls().length, 0);
  });
}

test("actual semantic_text sparse-model target fails clearly without legacy getters", async () => {
  description = indexDescription({
    text: { type: "semantic_text", model: "pinecone-sparse-english-v0", dimension: 0, metric: "dotproduct" },
  });
  stats = { dimension: 0, namespaces: {}, totalVectorCount: 0 };
  // Exercise v9's real response decoration: its legacy vectorType getter throws.
  const sdkDescription = await new Pinecone({ apiKey: API_KEY }).indexes.describe(INDEX_NAME);
  assert.throws(() => sdkDescription.vectorType, /Cannot read.*vectorType/);
  const pc = await adapter();
  await assert.rejects(pc.ensureIndex(), (error) => {
    assertSafeError(error, /Incompatible index/);
    assert.match((error as Error).message, /semantic_text.*pinecone-sparse-english-v0.*dimension=0.*dotproduct/);
    assert.match((error as Error).message, /does not provision indexes or switch embedding models/);
    return true;
  });
  await assert.rejects(pc.upsertChunks([point()]), /Incompatible index/);
  await assert.rejects(pc.vectorSearch(VECTOR), /Incompatible index/);
  await assert.rejects(pc.deleteByRepo("repo-1"), /Incompatible index/);
  assert.equal(await pc.countPoints(), -1);
  assert.equal(dataCalls().length, 0);
  // User correction may be retried without restarting after validation failure.
  description = indexDescription();
  await pc.ensureIndex();
});

test("host and index-name mismatches are rejected before data-plane requests", async () => {
  const pc = await adapter();
  description.host = "other-index.svc.example.pinecone.io";
  await assert.rejects(pc.ensureIndex(), /PINECONE_INDEX_HOST does not match/);
  await assert.rejects(pc.deleteByRepo("repo-1"), /PINECONE_INDEX_HOST does not match/);
  description = indexDescription();
  description.name = "different-index";
  await assert.rejects(pc.ensureIndex(), /PINECONE_INDEX_NAME does not match/);
  assert.equal(dataCalls().length, 0);
});

test("validation HTTP failures are sanitized, unavailable, and retryable", async (t) => {
  const logger = t.mock.method(console, "error", () => {});
  failures.set(`/indexes/${INDEX_NAME}`, { status: 403, message: `Rejected Api-Key: ${API_KEY}` });
  const pc = await adapter();
  await assert.rejects(pc.ensureIndex(), (error) => assertSafeError(error, /Index validation failed/));
  assert.equal(await pc.countPoints(), -1);
  assert.equal(dataCalls().length, 0);
  assert.equal(logger.mock.callCount(), 0);
  failures.clear();
  await pc.ensureIndex();
});

test("upsert preserves the deterministic SHA256 UUID and string nodeId roundtrip", async () => {
  const pc = await adapter();
  const p = point();
  p.payload.nodeId = "must-be-overwritten";
  p.payload.tags = ["one", "two"];
  p.payload.enabled = true;
  await pc.upsertChunks([p]);
  await pc.upsertChunks([p]);
  const writes = calls("/vectors/upsert");
  const first = (writes[0].body.vectors as WireRecord[])[0];
  assert.equal(first.id, "8830c046-fd5b-483f-9a0b-eaf4e9c270a2");
  assert.match(first.id, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.equal((writes[1].body.vectors as WireRecord[])[0].id, first.id);
  assert.equal(first.metadata.nodeId, p.id);
  assert.equal(typeof first.metadata.nodeId, "string");
  assert.deepEqual(first.values, p.vector);
  assert.deepEqual(first.metadata, { ...p.payload, nodeId: p.id });
  assert.equal(p.payload.nodeId, "must-be-overwritten", "caller payload must not be mutated");
  assert.equal(writes[0].body.namespace, "gitplus");
  assert.equal(requests[0].url.hostname, "api.pinecone.io");

  queryMatches = [{ ...first, score: 0.92 }];
  const hits = await pc.vectorSearch(VECTOR, undefined, 10, true);
  assert.equal(hits[0].id, p.id);
  assert.equal(hits[0].score, 0.92);
  assert.deepEqual(hits[0].payload, first.metadata);
  assert.deepEqual(hits[0].vector, p.vector);
});

test("flat metadata filters become AND equality predicates and values are opt-in", async () => {
  const pc = await adapter();
  queryMatches = [{ id: "fallback-id", score: 0.7, metadata: PAYLOAD, values: VECTOR }];
  const hits = await pc.vectorSearch(VECTOR, { repoId: "repo-1", level: "symbol", language: "typescript" }, 25);
  const request = calls("/query")[0];
  assert.deepEqual(request.body.filter, {
    $and: [{ repoId: { $eq: "repo-1" } }, { level: { $eq: "symbol" } }, { language: { $eq: "typescript" } }],
  });
  assert.equal(request.body.topK, 25);
  assert.equal(request.body.includeMetadata, true);
  assert.equal(request.body.includeValues, false);
  assert.equal(request.body.namespace, "gitplus");
  assert.deepEqual(request.body.vector, VECTOR);
  assert.equal(hits[0].id, "fallback-id");
  assert.equal(hits[0].vector, undefined, "unsolicited response values are not returned by default");

  await pc.vectorSearch(VECTOR, {}, undefined, true);
  const emptyFilter = calls("/query")[1].body;
  assert.equal(emptyFilter.topK, 10);
  assert.equal(emptyFilter.includeValues, true);
  assert.ok(!("filter" in emptyFilter));
  await pc.vectorSearch(VECTOR, { repoId: "repo-1" });
  assert.deepEqual(calls("/query")[2].body.filter, { $and: [{ repoId: { $eq: "repo-1" } }] });
});

test("upsert uses 100-record batches, preserving all records in order", async () => {
  const pc = await adapter();
  await pc.upsertChunks(Array.from({ length: 205 }, (_, i) => ({ ...point(`node-${i}`), vector: Array(1024).fill(0.125) })));
  const writes = calls("/vectors/upsert");
  assert.deepEqual(writes.map((write) => (write.body.vectors as WireRecord[]).length), [100, 100, 5]);
  assert.deepEqual(writes.flatMap((write) => (write.body.vectors as WireRecord[]).map((record) => record.metadata.nodeId)),
    Array.from({ length: 205 }, (_, i) => `node-${i}`));
  assert.ok(writes.every((write) => Buffer.byteLength(write.rawBody) <= 1_900_000));
});

test("upsert also respects the UTF-8 JSON byte budget with large vectors and metadata", async () => {
  const pc = await adapter();
  const payload = { ...PAYLOAD, filePath: "é".repeat(10_000) };
  await pc.upsertChunks(Array.from({ length: 100 }, (_, i) => point(`large-${i}`, payload)));
  const writes = calls("/vectors/upsert");
  assert.ok(writes.length > 1, "100 large records must not exceed 2 MB in one request");
  assert.ok(writes.every((write) => Buffer.byteLength(write.rawBody) <= 1_900_000));
  assert.ok(writes.every((write) => (write.body.vectors as WireRecord[]).length <= 100));
  assert.equal(writes.reduce((total, write) => total + (write.body.vectors as WireRecord[]).length, 0), 100);
});

test("empty upsert is a no-op even without configuration", async () => {
  for (const key of ENV_KEYS) delete process.env[key];
  const pc = await adapter();
  await pc.upsertChunks([]);
  assert.equal(requests.length, 0);
});

test("oversized single records and invalid vectors are preflighted before any writes", async () => {
  const pc = await adapter();
  const oversized = point("too-large", { ...PAYLOAD, filePath: "x".repeat(2_000_000) });
  await assert.rejects(pc.upsertChunks([point(), oversized]), /exceeds the safe 2 MB/);
  await assert.rejects(pc.upsertChunks([point(), { ...point(), vector: [1, 2] }]), /1024-dimensional/);
  await assert.rejects(pc.upsertChunks([{ ...point(), vector: Array(1024).fill(NaN) }]), /finite numbers/);
  await assert.rejects(pc.vectorSearch([1, 2]), /1024-dimensional/);
  assert.equal(dataCalls().length, 0);
});

test("repository deletion is filtered and namespace-scoped; SDK errors propagate safely", async () => {
  process.env.PINECONE_NAMESPACE = "gitplus-private";
  const pc = await adapter();
  await pc.deleteByRepo("repo-1");
  assert.deepEqual(calls("/vectors/delete")[0].body, {
    filter: { $and: [{ repoId: { $eq: "repo-1" } }] }, namespace: "gitplus-private",
  });
  failures.set("/vectors/delete", { status: 400, message: `Bad request containing key ${API_KEY}` });
  await assert.rejects(pc.deleteByRepo("repo-1"), (error) => assertSafeError(error, /Repository deletion failed/));
  assert.equal(calls("/vectors/delete").length, 2);
  assert.ok(calls("/vectors/delete").every((request) => !("deleteAll" in request.body) && !("ids" in request.body)));
});

test("query and upsert HTTP errors are sanitized without exposing raw SDK causes", async () => {
  const pc = await adapter();
  failures.set("/vectors/upsert", { status: 400, message: `Api-Key: ${API_KEY}` });
  failures.set("/query", { status: 403, message: `Api-Key: ${API_KEY}` });
  await assert.rejects(pc.upsertChunks([point()]), (error) => assertSafeError(error, /Vector upsert failed/));
  await assert.rejects(pc.vectorSearch(VECTOR), (error) => assertSafeError(error, /Vector query failed/));
});

test("every operation uses the configured dedicated namespace", async () => {
  process.env.PINECONE_NAMESPACE = "gitplus-custom";
  const pc = await adapter();
  await pc.upsertChunks([point()]);
  await pc.vectorSearch(VECTOR);
  await pc.deleteByRepo("repo-1");
  assert.ok(dataCalls().every((request) => request.body.namespace === "gitplus-custom"));
});

test("count returns only the configured namespace, never whole-index or default counts", async () => {
  process.env.PINECONE_NAMESPACE = "gitplus-custom";
  stats = {
    dimension: 1024,
    namespaces: { "": { vectorCount: 50 }, gitplus: { vectorCount: 30 }, "gitplus-custom": { vectorCount: 4 } },
    totalVectorCount: 84,
  };
  const pc = await adapter();
  assert.equal(await pc.countPoints(), 4);
  assert.equal(calls("/describe_index_stats").length, 1);
  assert.deepEqual(calls("/describe_index_stats")[0].body, {}, "stats API is index-wide; adapter selects namespace");
  stats = { dimension: 1024, namespaces: { other: { vectorCount: 99 } }, totalVectorCount: 99 };
  assert.equal(await pc.countPoints(), 0, "absent dedicated namespace is empty, not totalVectorCount");
});

test("count reports unavailable stats as -1", async () => {
  const pc = await adapter();
  failures.set("/describe_index_stats", { status: 403, message: `Unauthorized key ${API_KEY}` });
  assert.equal(await pc.countPoints(), -1);
  failures.clear();
  for (const summary of [{ vectorCount: -1 }, { vectorCount: 1.5 }, {}]) {
    stats = { dimension: 1024, namespaces: { gitplus: summary }, totalVectorCount: 100 };
    assert.equal(await pc.countPoints(), -1);
  }
});
