import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { request } from "node:http";
import { test } from "node:test";
import express from "express";
import pg from "pg";

function toRecordId(nodeId: string): string {
  return createHash("sha256").update(nodeId, "utf8").digest("hex");
}

const INDEX_NAME = "gitplus-ingest-test";
const INDEX_HOST = "gitplus-ingest-test.svc.example.pinecone.io";
const REPO_ID = "offline/repo";
const GEMINI_KEY = "offline-gemini-key";

type NodeRecord = {
  id: string;
  repoId: string;
  parentId: string | null;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimensions: number;
};
type WireRecord = {
  id: string;
  values: number[];
  metadata: Record<string, unknown>;
};

const offlinePrisma = {
  node: {
    async deleteMany(_args: { where: { repoId: string } }): Promise<{ count: number }> {
      throw new Error("Unmocked database deletion is prohibited");
    },
    async createMany(_args: { data: NodeRecord[]; skipDuplicates: boolean }): Promise<{ count: number }> {
      throw new Error("Unmocked database writes are prohibited");
    },
  },
  indexedRepo: {
    async upsert(): Promise<never> {
      throw new Error("IndexedRepo writes are prohibited");
    },
  },
};

function postJson(port: number, body: object): Promise<{ status: number | undefined; body: string }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = request({
      hostname: "127.0.0.1",
      port,
      path: "/api/search/ingest",
      method: "POST",
      agent: false,
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
    }, (res) => {
      res.setEncoding("utf8");
      let content = "";
      res.on("data", (chunk) => { content += chunk; });
      res.on("error", reject);
      res.on("end", () => resolve({ status: res.statusCode, body: content }));
    });
    req.on("error", reject);
    req.end(data);
  });
}

for (const scenario of [
  { name: "valid Gemini embeddings replace and mirror the repository", configuredDimensions: 1024, returnedDimensions: 1024, success: true },
  { name: "3072-dimensional Gemini output preserves the existing repository", configuredDimensions: 1024, returnedDimensions: 3072, success: false },
  { name: "incompatible configured dimensions fail before any upstream requests", configuredDimensions: 768, returnedDimensions: 768, success: false },
]) {
  test(`ingest: ${scenario.name}`, async (t) => {
    const values: Record<string, string | undefined> = {
      EMBEDDING_PROVIDER: "gemini",
      EMBEDDING_MODEL: undefined,
      GOOGLE_GEMINI_EMBEDDING_MODEL: "gemini-embedding-001",
      GEMINI_EMBEDDING_MODEL: undefined,
      OPENAI_EMBEDDING_MODEL: undefined,
      EMBEDDING_DIMENSIONS: String(scenario.configuredDimensions),
      GOOGLE_GEMINI_API_KEY: GEMINI_KEY,
      GOOGLE_GEMINI_MODEL: "offline-summary-model",
      OPENAI_API_KEY: undefined,
      PINECONE_API_KEY: "offline-pinecone-key",
      PINECONE_INDEX_NAME: INDEX_NAME,
      PINECONE_INDEX_HOST: INDEX_HOST,
      PINECONE_NAMESPACE: "gitplus-ingest-tests",
      DATABASE_URL: "postgresql://offline:offline@127.0.0.1:9/offline",
    };
    const previous = Object.fromEntries(Object.keys(values).map((name) => [name, process.env[name]]));
    t.after(() => {
      for (const [name, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    });
    for (const [name, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }

    const poolConnect = t.mock.method(pg.Pool.prototype, "connect", () => {
      throw new Error("Database connections are prohibited in offline ingestion tests");
    });
    const clientConnect = t.mock.method(pg.Client.prototype, "connect", () => {
      throw new Error("Database connections are prohibited in offline ingestion tests");
    });
    t.mock.method(console, "error", () => {});
    const globalForPrisma = globalThis as unknown as { prisma?: unknown };
    const previousPrisma = globalForPrisma.prisma;
    globalForPrisma.prisma = offlinePrisma;
    t.after(() => {
      if (previousPrisma === undefined) delete globalForPrisma.prisma;
      else globalForPrisma.prisma = previousPrisma;
    });
    const { prisma } = await import("../src/lib/prisma.js");
    assert.equal(prisma, offlinePrisma);
    const oldNodes = [{ id: "existing-node", repoId: REPO_ID }];
    let storedNodes: object[] = [...oldNodes];
    const deleted = t.mock.method(prisma.node, "deleteMany", async (args) => {
      assert.ok(scenario.success, "failed ingestion must not attempt database deletion");
      assert.deepEqual(args, { where: { repoId: REPO_ID } });
      storedNodes = [];
      return { count: oldNodes.length };
    });
    const created = t.mock.method(prisma.node, "createMany", async (args) => {
      assert.ok(scenario.success, "failed ingestion must not attempt database writes");
      assert.equal(args.skipDuplicates, true);
      storedNodes = [...args.data as NodeRecord[]];
      return { count: storedNodes.length };
    });
    const indexedRepoUpsert = t.mock.method(prisma.indexedRepo, "upsert", async () => {
      throw new Error("Unexpected IndexedRepo write in offline ingestion tests");
    });
    const upstreamRequests: URL[] = [];
    const dataPlaneRequests: { path: string; body: Record<string, unknown> }[] = [];
    const embeddingInputs: string[] = [];
    let summaryCalls = 0;
    t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      upstreamRequests.push(url);
      if (url.origin === "https://api.pinecone.io" && url.pathname === `/indexes/${INDEX_NAME}`) {
        return Response.json({
          name: INDEX_NAME,
          host: INDEX_HOST,
          status: { ready: true, state: "Ready" },
          deployment: { deployment_type: "managed", cloud: "aws", region: "us-east-1" },
          schema: { fields: {
            _values: { type: "dense_vector", dimension: 1024, metric: "cosine" },
            _sparse_values: { type: "sparse_vector" },
            repoId: { filterable: true },
          } },
          deletion_protection: "disabled",
        });
      }
      assert.equal(typeof init?.body, "string");
      const body = JSON.parse(init!.body as string);
      if (url.href === "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions") {
        summaryCalls++;
        return Response.json({ choices: [{ message: { content: "Offline repository summary." } }] });
      }
      if (url.href === "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents") {
        assert.equal(init?.method, "POST");
        assert.equal(new Headers(init?.headers).get("x-goog-api-key"), GEMINI_KEY);
        assert.ok(Array.isArray(body.requests));
        for (const item of body.requests) {
          assert.equal(item.model, "models/gemini-embedding-001");
          assert.equal(item.outputDimensionality, 1024);
          embeddingInputs.push(item.content.parts[0].text);
        }
        return Response.json({ embeddings: body.requests.map(() => ({ values: Array(scenario.returnedDimensions).fill(0.125) })) });
      }
      if (url.origin === `https://${INDEX_HOST}`) {
        dataPlaneRequests.push({ path: url.pathname, body });
        assert.ok(scenario.success, "failed ingestion must not attempt Pinecone deletion or writes");
        assert.equal(body.namespace, "gitplus-ingest-tests");
        if (url.pathname === "/vectors/delete") return Response.json({});
        if (url.pathname === "/vectors/upsert") return Response.json({ upsertedCount: body.vectors.length });
      }
      assert.fail(`Unexpected upstream request ${url.href}; external network is blocked`);
    });

    const { default: router } = await import("../src/routes/search.js");
    const app = express();
    app.use(express.json());
    app.use("/api/search", router);
    const server = app.listen(0, "127.0.0.1");
    t.after(async () => {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    });
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await postJson(address.port, {
      repoId: REPO_ID,
      files: [{ path: "src/example.ts", content: 'export function greet() { return "hello"; }\n' }],
    });
    const responseBody = JSON.parse(response.body);

    if (scenario.success) {
      assert.equal(response.status, 200);
      assert.equal(responseBody.success, true);
      assert.deepEqual(responseBody.embedding, { provider: "gemini", model: "gemini-embedding-001", dimensions: 1024 });
      assert.equal(deleted.mock.callCount(), 1);
      assert.equal(created.mock.callCount(), 1);
      assert.deepEqual(dataPlaneRequests.map((entry) => entry.path), ["/vectors/delete", "/vectors/upsert"]);
      assert.deepEqual(dataPlaneRequests[0].body.filter, { $and: [{ repoId: { $eq: REPO_ID } }] });
      const records = dataPlaneRequests[1].body.vectors as WireRecord[];
      assert.ok(records.length >= 4, "real chunker must produce repo, module, file and symbol nodes");
      assert.equal(responseBody.count, records.length);
      assert.equal(embeddingInputs.length, records.length);
      assert.equal(storedNodes.length, records.length);
      const nodeIds = (storedNodes as NodeRecord[]).map((node) => node.id);
      // Pinecone storage keys are SHA-256 derivations; Postgres keeps the
      // original IDs and each record carries its original in metadata.nodeId.
      assert.deepEqual(records.map((record) => record.id), nodeIds.map(toRecordId));
      assert.deepEqual(records.map((record) => record.metadata.nodeId), nodeIds);
      // Every parent reference resolves to a mirrored original ID.
      const nodeIdSet = new Set(nodeIds);
      for (const node of storedNodes as NodeRecord[]) {
        assert.equal(node.repoId, REPO_ID);
        if (node.parentId !== null) assert.ok(nodeIdSet.has(node.parentId), `dangling parentId ${node.parentId}`);
      }
      for (const record of records) {
        assert.match(record.id, /^[0-9a-f]{64}$/);
        assert.equal(record.values.length, 1024);
        assert.equal(record.metadata.embeddingProvider, "gemini");
        assert.equal(record.metadata.embeddingModel, "gemini-embedding-001");
        assert.equal(record.metadata.embeddingDimensions, 1024);
      }
      for (const node of storedNodes as NodeRecord[]) {
        assert.equal(node.embeddingProvider, "gemini");
        assert.equal(node.embeddingModel, "gemini-embedding-001");
        assert.equal(node.embeddingDimensions, 1024);
      }
    } else {
      assert.equal(response.status, 500);
      assert.equal(deleted.mock.callCount(), 0);
      assert.equal(created.mock.callCount(), 0);
      assert.equal(dataPlaneRequests.length, 0);
      assert.deepEqual(storedNodes, oldNodes);
      if (scenario.configuredDimensions === 768) {
        assert.match(responseBody.error, /768/);
        assert.match(responseBody.error, /1024/);
        assert.equal(upstreamRequests.length, 0);
        assert.equal(summaryCalls, 0);
        assert.equal(embeddingInputs.length, 0);
      } else {
        assert.match(responseBody.error, /expected.*1024/i);
        assert.match(responseBody.error, /received.*3072/i);
        assert.ok(summaryCalls > 0);
        assert.ok(embeddingInputs.length >= 4);
      }
    }
    assert.equal(indexedRepoUpsert.mock.callCount(), 0);
    assert.equal(poolConnect.mock.callCount(), 0);
    assert.equal(clientConnect.mock.callCount(), 0);
  });
}
