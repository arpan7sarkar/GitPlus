import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { request, type IncomingHttpHeaders } from "node:http";
import { test } from "node:test";
import express from "express";
import pg from "pg";
import { ReingestRequiredError } from "../src/lib/embeddings.js";

const REPO_ID = "offline/retrieval";
const INDEX_NAME = "gitplus-retrieval-test";
const INDEX_HOST = "gitplus-retrieval-test.svc.example.pinecone.io";
const NAMESPACE = "gitplus-retrieval-tests";
const MODEL = "gemini-embedding-001";
const QUERY = "greet";
const VECTOR = Array(1024).fill(0.125);
const FALLBACK = "STATIC_FALLBACK_SENTINEL";
const STREAM = 'data: {"choices":[{"delta":{"content":"Offline reply"}}]}\n\ndata: [DONE]\n\n';

function node(id = `${REPO_ID}::src/café.ts:1-3`) {
  return {
    id, level: "symbol", parentId: `${REPO_ID}::file:src/café.ts`,
    filePath: "src/café.ts", symbolName: "greet", parentSymbolPath: null,
    symbolType: "function", language: "typescript", category: "utility",
    startLine: 1, endLine: 3, code: 'export function greet() { return "hello"; }',
    summary: null, embeddingText: "greet function hello",
    embeddingProvider: "gemini" as string | null,
    embeddingModel: MODEL as string | null,
    embeddingDimensions: 1024 as number | null,
  };
}

type NodeFixture = ReturnType<typeof node>;
type Parent = { id: string; level: string; filePath: string; summary: string };
type FindArgs = {
  where: { repoId?: string; id?: { in: string[] }; level?: string; category?: string; language?: string };
  select: Record<string, boolean>;
};

function match(n: NodeFixture, values = VECTOR) {
  return {
    id: createHash("sha256").update(n.id).digest("hex"), score: 0.9, values,
    metadata: {
      nodeId: n.id, repoId: REPO_ID, level: n.level, filePath: n.filePath,
      symbolType: n.symbolType, language: n.language, category: n.category,
      startLine: n.startLine, endLine: n.endLine, lineRange: "1-3",
      ...(n.embeddingProvider === null ? {} : { embeddingProvider: n.embeddingProvider }),
      ...(n.embeddingModel === null ? {} : { embeddingModel: n.embeddingModel }),
      ...(n.embeddingDimensions === null ? {} : { embeddingDimensions: n.embeddingDimensions }),
    },
  };
}

function postJson(port: number, path: string, body: object): Promise<{
  status: number | undefined; headers: IncomingHttpHeaders; body: string;
}> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = request({
      hostname: "127.0.0.1", port, path, method: "POST", agent: false,
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
    }, (res) => {
      res.setEncoding("utf8");
      let content = "";
      res.on("data", (chunk) => { content += chunk; });
      res.on("error", reject);
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: content }));
    });
    req.on("error", reject);
    req.setTimeout(5000, () => req.destroy(new Error("Offline HTTP request timed out")));
    req.end(data);
  });
}

test("real retrieval and HTTP routes enforce index provenance", async (t) => {
  const values: Record<string, string | undefined> = {
    EMBEDDING_PROVIDER: "gemini", EMBEDDING_MODEL: undefined,
    GOOGLE_GEMINI_EMBEDDING_MODEL: MODEL, GEMINI_EMBEDDING_MODEL: undefined,
    OPENAI_EMBEDDING_MODEL: undefined, EMBEDDING_DIMENSIONS: "1024",
    GOOGLE_GEMINI_API_KEY: "offline-gemini-key", OPENAI_API_KEY: undefined,
    PINECONE_API_KEY: "offline-pinecone-key", PINECONE_INDEX_NAME: INDEX_NAME,
    PINECONE_INDEX_HOST: INDEX_HOST, PINECONE_NAMESPACE: NAMESPACE,
    DATABASE_URL: "postgresql://offline:offline@127.0.0.1:9/offline",
  };
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  const poolConnect = t.mock.method(pg.Pool.prototype, "connect", () => {
    throw new Error("Real database connections are prohibited");
  });
  const clientConnect = t.mock.method(pg.Client.prototype, "connect", () => {
    throw new Error("Real database connections are prohibited");
  });
  t.mock.method(console, "warn", () => {});
  t.mock.method(console, "error", () => {});

  let nodes: NodeFixture[] = [];
  let matches: ReturnType<typeof match>[] = [];
  let parents: Parent[] = [];
  let filter: Record<string, string> = {};
  let databaseError: Error | undefined;
  let dbCalls: FindArgs[] = [];
  let embeddingCalls = 0;
  let queryCalls = 0;
  let completions: { model: string; stream: boolean; messages: { role: string; content: string }[] }[] = [];
  let violations: unknown[] = [];

  const offlinePrisma = { node: { async findMany(args: FindArgs): Promise<(NodeFixture | Parent)[]> {
    dbCalls.push(args);
    if (databaseError) throw databaseError;
    if (args.where.id) {
      assert.deepEqual(args.where.id.in, [...new Set(nodes.map((n) => n.parentId))]);
      return parents;
    }
    assert.deepEqual(args.where, { repoId: REPO_ID, ...filter });
    for (const key of ["embeddingProvider", "embeddingModel", "embeddingDimensions"]) {
      assert.equal(args.select[key], true);
    }
    return nodes;
  } } };
  const globals = globalThis as unknown as { prisma?: unknown };
  const previousPrisma = globals.prisma;
  globals.prisma = offlinePrisma;
  t.after(() => {
    if (previousPrisma === undefined) delete globals.prisma;
    else globals.prisma = previousPrisma;
  });

  // Pinecone captures fetch once, so every sequential case uses this dispatcher.
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.origin === "https://api.pinecone.io" && url.pathname === `/indexes/${INDEX_NAME}`) {
        return Response.json({
          name: INDEX_NAME, host: INDEX_HOST, status: { ready: true, state: "Ready" },
          deployment: { deployment_type: "managed", cloud: "aws", region: "us-east-1" },
          schema: { fields: {
            _values: { type: "dense_vector", dimension: 1024, metric: "cosine" },
            _sparse_values: { type: "sparse_vector" }, repoId: { filterable: true },
          } }, deletion_protection: "disabled",
        });
      }
      assert.equal(typeof init?.body, "string");
      const body = JSON.parse(init!.body as string);
      if (url.href === `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:batchEmbedContents`) {
        embeddingCalls++;
        assert.equal(init?.method, "POST");
        assert.equal(new Headers(init?.headers).get("x-goog-api-key"), "offline-gemini-key");
        assert.deepEqual(body.requests, [{
          model: `models/${MODEL}`, content: { parts: [{ text: QUERY }] }, outputDimensionality: 1024,
        }]);
        return Response.json({ embeddings: [{ values: VECTOR }] });
      }
      if (url.origin === `https://${INDEX_HOST}` && url.pathname === "/query") {
        queryCalls++;
        assert.equal(body.namespace, NAMESPACE);
        assert.equal(body.topK, 25);
        assert.equal(body.includeMetadata, true);
        assert.equal(body.includeValues, true);
        assert.deepEqual(body.vector, VECTOR);
        assert.deepEqual(body.filter, { $and: Object.entries({ repoId: REPO_ID, ...filter })
          .map(([key, value]) => ({ [key]: { $eq: value } })) });
        return Response.json({ matches, namespace: NAMESPACE });
      }
      if (url.href === "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions") {
        completions.push(body);
        assert.equal(body.model, "gemini-2.0-flash");
        assert.equal(body.stream, true);
        return new Response(STREAM, { headers: { "Content-Type": "text/event-stream" } });
      }
      assert.fail(`Unexpected upstream request ${url.href}; external network is blocked`);
    } catch (error) {
      violations.push(error);
      throw error;
    }
  });

  const { prisma } = await import("../src/lib/prisma.js");
  assert.equal(prisma, offlinePrisma);
  const { retrieveForQuery } = await import("../src/lib/retrieval.js");
  const { default: chat } = await import("../src/routes/chat.js");
  const { default: search } = await import("../src/routes/search.js");
  const app = express();
  app.use(express.json());
  app.use("/api/chat", chat);
  app.use("/api/search", search);
  const server = app.listen(0, "127.0.0.1");
  t.after(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;

  function reset(dbNodes: NodeFixture[] = [node()], dense = dbNodes.map((n) => match(n))) {
    nodes = dbNodes;
    matches = dense;
    parents = [{ id: node().parentId, level: "file", filePath: "src/café.ts", summary: "Parent file summary." }];
    filter = {};
    databaseError = undefined;
    dbCalls = [];
    embeddingCalls = 0;
    queryCalls = 0;
    completions = [];
    violations = [];
  }

  function assertIO() {
    assert.deepEqual(violations, []);
    assert.equal(embeddingCalls, 1);
    assert.equal(queryCalls, 1);
    assert.equal(poolConnect.mock.callCount(), 0);
    assert.equal(clientConnect.mock.callCount(), 0);
  }

  const mismatched = { ...node(), embeddingModel: "previous-gemini-embedding-model" };
  const untagged = { ...node(), embeddingProvider: null, embeddingModel: null, embeddingDimensions: null };
  const rejected = [
    { name: "dense same-provider model change", nodes: [node()], matches: [match(mismatched)], diagnostic: /previous-gemini-embedding-model/ },
    { name: "PostgreSQL same-provider model change", nodes: [mismatched], matches: [match(node())], diagnostic: /previous-gemini-embedding-model/ },
    { name: "untagged dense vectors", nodes: [node()], matches: [match(untagged)], diagnostic: /predate embedding-model tracking/ },
    { name: "legacy PostgreSQL nodes with empty Pinecone", nodes: [untagged], matches: [], diagnostic: /no Pinecone vectors/ },
  ];

  for (const scenario of rejected) {
    await t.test(`retrieveForQuery rejects ${scenario.name}`, async () => {
      reset(scenario.nodes, scenario.matches);
      await assert.rejects(retrieveForQuery(QUERY, REPO_ID), (error: unknown) => {
        assert.ok(error instanceof ReingestRequiredError);
        assert.match(error.message, scenario.diagnostic);
        assert.match(error.userMessage, /re-index this repository/i);
        return true;
      });
      assert.equal(dbCalls.length, 1, "rejection must precede parent expansion");
      assert.equal(completions.length, 0);
      assertIO();
    });
  }

  await t.test("retrieveForQuery preserves genuinely unindexed empty results", async () => {
    reset([], []);
    assert.deepEqual(await retrieveForQuery(QUERY, REPO_ID), { chunks: [], contextText: "" });
    assert.equal(dbCalls.length, 1);
    assertIO();
  });

  await t.test("retrieveForQuery preserves compatible tagged keyword-only results", async () => {
    reset([node()], []);
    const result = await retrieveForQuery(QUERY, REPO_ID);
    assert.deepEqual(result.chunks.map((c) => c.id), [node().id]);
    assert.match(result.contextText, /Parent file summary/);
    assert.equal(dbCalls.length, 2);
    assertIO();
  });

  await t.test("retrieveForQuery propagates filters and recovers original IDs and parent context", async () => {
    reset();
    filter = { level: "symbol", category: "utility", language: "typescript" };
    const result = await retrieveForQuery(QUERY, REPO_ID, { ...filter, level: "symbol", k: 1 });
    assert.equal(result.chunks.length, 1);
    const chunk = result.chunks[0];
    assert.equal(chunk.id, node().id);
    assert.equal(chunk.text, node().code);
    assert.equal(chunk.score, 2 / 61);
    assert.deepEqual(chunk.parentContext, { level: "file", filePath: "src/café.ts", summary: "Parent file summary." });
    assert.match(result.contextText, /src\/café.ts:1-3/);
    assert.match(result.contextText, /function `greet`/);
    assert.match(result.contextText, /Parent file summary/);
    assert.equal(dbCalls.length, 2);
    assertIO();
  });

  await t.test("retrieveForQuery diversifies real fused candidates with MMR", async () => {
    const candidates = [node(), node(`${REPO_ID}::duplicate`), node(`${REPO_ID}::diverse`)];
    const aligned = Array.from({ length: 1024 }, (_, i) => i === 0 ? 1 : 0);
    const orthogonal = Array.from({ length: 1024 }, (_, i) => i === 1 ? 1 : 0);
    reset(candidates, candidates.map((n, i) => match(n, i === 2 ? orthogonal : aligned)));
    const result = await retrieveForQuery(QUERY, REPO_ID, { k: 2 });
    assert.deepEqual(result.chunks.map((c) => c.id), [candidates[0].id, candidates[2].id]);
    assertIO();
  });

  const chatBody = {
    repoId: REPO_ID, repoContext: FALLBACK,
    messages: [
      { role: "user", content: "Earlier question" }, { role: "assistant", content: "Earlier answer" },
      { role: "user", content: QUERY }, { role: "assistant", content: "Not the query" },
    ],
  };
  for (const scenario of rejected) {
    for (const path of ["/api/chat", "/api/search/hybrid"]) {
      await t.test(`${path} returns 409 JSON for ${scenario.name} without generation`, async () => {
        reset(scenario.nodes, scenario.matches);
        const response = await postJson(port, path, path === "/api/chat" ? chatBody : { query: QUERY, repoId: REPO_ID });
        assert.equal(response.status, 409);
        assert.match(response.headers["content-type"] || "", /^application\/json/);
        assert.equal(response.headers["cache-control"], undefined);
        const body = JSON.parse(response.body);
        assert.deepEqual(body, { error: new ReingestRequiredError().userMessage });
        assert.doesNotMatch(body.error, /POST \/api|previous-gemini|\[embeddings\]/);
        assert.equal(completions.length, 0);
        assert.equal(dbCalls.length, 1);
        assertIO();
      });
    }
  }

  await t.test("hybrid HTTP search returns compatible citations and parent context", async () => {
    reset();
    filter = { level: "symbol", category: "utility", language: "typescript" };
    const response = await postJson(port, "/api/search/hybrid", { query: QUERY, repoId: REPO_ID, filter });
    assert.equal(response.status, 200);
    const { results } = JSON.parse(response.body);
    assert.equal(results.length, 1);
    assert.equal(results[0].id, node().id);
    assert.equal(results[0].codeSnippet, node().code);
    assert.equal(results[0].parentContext.summary, "Parent file summary.");
    assert.equal(completions.length, 0);
    assertIO();
  });

  for (const fallback of [false, true]) {
    await t.test(`chat streams with ${fallback ? "unindexed fallback" : "fresh retrieved context"}`, async () => {
      reset(fallback ? [] : [node()]);
      const response = await postJson(port, "/api/chat", chatBody);
      assert.equal(response.status, 200);
      assert.match(response.headers["content-type"] || "", /^text\/event-stream/);
      assert.equal(response.body, STREAM);
      assert.equal(completions.length, 1);
      const prompt = completions[0].messages[0].content;
      if (fallback) assert.ok(prompt.includes(FALLBACK));
      else {
        assert.ok(prompt.includes(node().code));
        assert.ok(prompt.includes("Parent file summary."));
        assert.ok(!prompt.includes(FALLBACK));
      }
      assertIO();
    });
  }

  await t.test("ordinary retrieval errors are not classified by message text and preserve chat fallback", async () => {
    reset();
    databaseError = new Error("[embeddings] unrelated outage. Re-ingest the repository");
    const response = await postJson(port, "/api/chat", chatBody);
    assert.equal(response.status, 200);
    assert.match(response.headers["content-type"] || "", /^text\/event-stream/);
    assert.equal(response.body, STREAM);
    assert.equal(completions.length, 1);
    assert.ok(completions[0].messages[0].content.includes(FALLBACK));
    assertIO();
  });

  await t.test("hybrid keeps ordinary retrieval failures as HTTP 500", async () => {
    reset();
    databaseError = new Error("Offline database unavailable");
    const response = await postJson(port, "/api/search/hybrid", { query: QUERY, repoId: REPO_ID });
    assert.equal(response.status, 500);
    assert.deepEqual(JSON.parse(response.body), { error: "Offline database unavailable" });
    assert.equal(completions.length, 0);
    assertIO();
  });
});
