import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertEmbeddingConsistency,
  describeEmbedding,
  generateEmbedding,
  generateEmbeddingsBatch,
  getEmbeddingConfig,
} from "../src/lib/embeddings.js";
import {
  getEmbeddingDimensions,
  getEmbeddingModel,
  getEmbeddingProvider,
} from "../src/lib/models.js";

const ENV_KEYS = [
  "EMBEDDING_PROVIDER",
  "EMBEDDING_MODEL",
  "OPENAI_EMBEDDING_MODEL",
  "GEMINI_EMBEDDING_MODEL",
  "GOOGLE_GEMINI_EMBEDDING_MODEL",
  "EMBEDDING_DIMENSIONS",
  "OPENAI_API_KEY",
  "GOOGLE_GEMINI_API_KEY",
] as const;

function setEnv(t: { after: (fn: () => void) => void }, values: Record<string, string | undefined>) {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  t.after(() => {
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
  for (const key of ENV_KEYS) {
    if (values[key] === undefined) {
      if (!(key in values)) continue;
      delete process.env[key];
    } else {
      process.env[key] = values[key];
    }
  }
}

function clearEmbeddingEnv(t: { after: (fn: () => void) => void }) {
  setEnv(t, Object.fromEntries(ENV_KEYS.map((key) => [key, undefined])));
}

test("embedding config defaults to OpenAI text-embedding-3-large @ 1024d", (t) => {
  clearEmbeddingEnv(t);
  assert.equal(getEmbeddingProvider(), "openai");
  assert.equal(getEmbeddingModel(), "text-embedding-3-large");
  assert.equal(getEmbeddingDimensions(), 1024);
  assert.deepEqual(getEmbeddingConfig(), {
    provider: "openai",
    model: "text-embedding-3-large",
    dimensions: 1024,
  });
  assert.equal(describeEmbedding(getEmbeddingConfig()), "openai/text-embedding-3-large @1024d");
});

test("EMBEDDING_PROVIDER=gemini is honored even when an OpenAI key exists (no auto-switch)", (t) => {
  clearEmbeddingEnv(t);
  setEnv(t, { EMBEDDING_PROVIDER: "gemini", OPENAI_API_KEY: `offline-openai-${t.name}` });
  assert.equal(getEmbeddingProvider(), "gemini");
  assert.equal(getEmbeddingModel(), "gemini-embedding-001");
});

test("invalid EMBEDDING_PROVIDER and EMBEDDING_DIMENSIONS throw clearly", (t) => {
  clearEmbeddingEnv(t);
  setEnv(t, { EMBEDDING_PROVIDER: "cohere" });
  assert.throws(() => getEmbeddingProvider(), /Invalid EMBEDDING_PROVIDER/);
  assert.throws(() => getEmbeddingConfig(), /Invalid EMBEDDING_PROVIDER/);
  setEnv(t, { EMBEDDING_PROVIDER: undefined, EMBEDDING_DIMENSIONS: "not-a-number" });
  assert.throws(() => getEmbeddingDimensions(), /Invalid EMBEDDING_DIMENSIONS/);
});

test("model and dimension overrides are explicit per provider", (t) => {
  clearEmbeddingEnv(t);
  setEnv(t, { OPENAI_EMBEDDING_MODEL: " offline-openai-override " });
  assert.equal(getEmbeddingModel("openai"), "offline-openai-override");
  setEnv(t, { OPENAI_EMBEDDING_MODEL: undefined, EMBEDDING_MODEL: "generic-override" });
  assert.equal(getEmbeddingModel("openai"), "generic-override");
  assert.equal(getEmbeddingModel("gemini"), "generic-override");
  setEnv(t, {
    EMBEDDING_MODEL: undefined,
    GOOGLE_GEMINI_EMBEDDING_MODEL: "offline-gemini-override",
    EMBEDDING_DIMENSIONS: "768",
  });
  assert.equal(getEmbeddingModel("gemini"), "offline-gemini-override");
  assert.equal(getEmbeddingDimensions(), 768);
});

test("generateEmbedding requires a key for the configured provider", async (t) => {
  clearEmbeddingEnv(t);
  setEnv(t, { EMBEDDING_PROVIDER: "openai" });
  await assert.rejects(generateEmbedding("hello"), /OPENAI_API_KEY is missing for EMBEDDING_PROVIDER=openai/);
  setEnv(t, { EMBEDDING_PROVIDER: "gemini" });
  await assert.rejects(generateEmbedding("hello"), /GOOGLE_GEMINI_API_KEY is missing for EMBEDDING_PROVIDER=gemini/);
});

test("generateEmbedding calls the explicitly configured provider and model", async (t) => {
  clearEmbeddingEnv(t);
  setEnv(t, { EMBEDDING_PROVIDER: "openai", OPENAI_API_KEY: `offline-openai-${t.name}` });
  // The OpenAI SDK requests base64-encoded vectors by default; use float32-exact
  // values so the decoded result compares strictly equal.
  const floats = Array.from({ length: 1024 }, (_, i) => i % 2 === 0 ? 0.5 : -1.25);
  const b64 = Buffer.from(new Float32Array(floats).buffer).toString("base64");
  const upstream = t.mock.method(globalThis, "fetch", async (input: unknown, init?: { body?: unknown }) => {
    assert.equal(String(input), "https://api.openai.com/v1/embeddings");
    const body = JSON.parse(init?.body as string);
    assert.equal(body.model, "text-embedding-3-large");
    assert.equal(body.dimensions, 1024);
    return Response.json({
      object: "list",
      data: [{ object: "embedding", embedding: b64, index: 0 }],
      model: body.model,
      usage: { prompt_tokens: 1, total_tokens: 1 },
    });
  });
  assert.deepEqual(await generateEmbedding("hello"), floats);
  assert.equal(upstream.mock.callCount(), 1);
});

test("generateEmbedding uses Gemini's native dimensionality control", async (t) => {
  clearEmbeddingEnv(t);
  setEnv(t, {
    EMBEDDING_PROVIDER: "gemini",
    GOOGLE_GEMINI_API_KEY: "offline-gemini-key",
    OPENAI_API_KEY: `offline-openai-${t.name}`,
  });
  const floats = Array(1024).fill(0.5);
  const upstream = t.mock.method(globalThis, "fetch", async (input: unknown, init?: RequestInit) => {
    assert.equal(String(input), "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents");
    assert.equal(init?.method, "POST");
    assert.equal(new Headers(init?.headers).get("x-goog-api-key"), "offline-gemini-key");
    assert.deepEqual(JSON.parse(init?.body as string), {
      requests: [{
        model: "models/gemini-embedding-001",
        content: { parts: [{ text: "hello" }] },
        outputDimensionality: 1024,
      }],
    });
    return Response.json({ embeddings: [{ values: floats }] });
  });
  assert.deepEqual(await generateEmbedding("hello"), floats);
  assert.equal(upstream.mock.callCount(), 1);
});

function embeddingResponse(provider: "openai" | "gemini", vectors: unknown[]) {
  return Response.json(provider === "gemini"
    ? { embeddings: vectors.map((values) => ({ values })) }
    : { data: vectors.map((vector, index) => ({
      embedding: Buffer.from(new Float32Array(vector as number[]).buffer).toString("base64"),
      index,
    })) });
}

for (const provider of ["openai", "gemini"] as const) {
  test(`${provider} batches preserve order, dimensions and text limits`, async (t) => {
    clearEmbeddingEnv(t);
    setEnv(t, {
      EMBEDDING_PROVIDER: provider,
      OPENAI_API_KEY: `offline-openai-${t.name}`,
      GOOGLE_GEMINI_API_KEY: "offline-gemini-key",
    });
    const texts = Array.from({ length: 101 }, (_, i) => `text-${i}`);
    texts[0] = "x".repeat(9000);
    const received: string[] = [];
    const sizes: number[] = [];
    const upstream = t.mock.method(globalThis, "fetch", async (_input, init) => {
      const body = JSON.parse(init?.body as string);
      const batch: string[] = provider === "gemini"
        ? body.requests.map((item: { content: { parts: { text: string }[] }; outputDimensionality: number }) => {
          assert.equal(item.outputDimensionality, 1024);
          return item.content.parts[0].text;
        })
        : body.input;
      if (provider === "openai") assert.equal(body.dimensions, 1024);
      sizes.push(batch.length);
      const offset = received.length;
      received.push(...batch);
      return embeddingResponse(provider, batch.map((_, i) => Array(1024).fill(offset + i + 0.5)));
    });
    const vectors = await generateEmbeddingsBatch(texts);
    assert.deepEqual(received, texts.map((text) => text.slice(0, 8000)));
    assert.deepEqual(sizes, [100, 1]);
    assert.equal(upstream.mock.callCount(), 2);
    assert.equal(vectors.length, texts.length);
    for (const [i, vector] of vectors.entries()) {
      assert.deepEqual(vector, Array(1024).fill(i + 0.5));
    }
  });

  for (const batched of [false, true]) {
    test(`${provider} rejects 3072-dimensional ${batched ? "batch" : "query"} vectors`, async (t) => {
      clearEmbeddingEnv(t);
      setEnv(t, {
        EMBEDDING_PROVIDER: provider,
        OPENAI_API_KEY: `offline-openai-${t.name}`,
        GOOGLE_GEMINI_API_KEY: "offline-gemini-key",
      });
      const upstream = t.mock.method(globalThis, "fetch", async () =>
        embeddingResponse(provider, [Array(3072).fill(0.5)])
      );
      await assert.rejects(batched ? generateEmbeddingsBatch(["hello"]) : generateEmbedding("hello"),
        /dimension mismatch: expected 1024, received 3072/);
      assert.equal(upstream.mock.callCount(), 1);
    });
  }

  for (const count of [0, 2]) {
    test(`${provider} rejects a query response with ${count} vectors`, async (t) => {
      clearEmbeddingEnv(t);
      setEnv(t, {
        EMBEDDING_PROVIDER: provider,
        OPENAI_API_KEY: `offline-openai-${t.name}`,
        GOOGLE_GEMINI_API_KEY: "offline-gemini-key",
      });
      t.mock.method(globalThis, "fetch", async () =>
        embeddingResponse(provider, Array.from({ length: count }, () => Array(1024).fill(0.5)))
      );
      await assert.rejects(generateEmbedding("hello"), new RegExp(`expected 1, received ${count}`));
    });
  }

  test(`${provider} rejects a short batch response`, async (t) => {
    clearEmbeddingEnv(t);
    setEnv(t, {
      EMBEDDING_PROVIDER: provider,
      OPENAI_API_KEY: `offline-openai-${t.name}`,
      GOOGLE_GEMINI_API_KEY: "offline-gemini-key",
    });
    t.mock.method(globalThis, "fetch", async () => embeddingResponse(provider, [Array(1024).fill(0.5)]));
    await assert.rejects(generateEmbeddingsBatch(["one", "two"]), /expected 2, received 1/);
  });

  test(`${provider} rejects invalid numeric values`, async (t) => {
    clearEmbeddingEnv(t);
    setEnv(t, {
      EMBEDDING_PROVIDER: provider,
      OPENAI_API_KEY: `offline-openai-${t.name}`,
      GOOGLE_GEMINI_API_KEY: "offline-gemini-key",
    });
    const floats = Array(1024).fill(0.5);
    floats[0] = provider === "openai" ? Infinity : null;
    t.mock.method(globalThis, "fetch", async () => embeddingResponse(provider, [floats]));
    await assert.rejects(generateEmbedding("hello"), /non-finite or non-numeric/);
  });

  test(`${provider} rejects the whole operation when a later batch is malformed`, async (t) => {
    clearEmbeddingEnv(t);
    setEnv(t, {
      EMBEDDING_PROVIDER: provider,
      OPENAI_API_KEY: `offline-openai-${t.name}`,
      GOOGLE_GEMINI_API_KEY: "offline-gemini-key",
    });
    const upstream = t.mock.method(globalThis, "fetch", async (_input, init) => {
      const body = JSON.parse(init?.body as string);
      const count = provider === "gemini" ? body.requests.length : body.input.length;
      const dimensions = count === 100 ? 1024 : 3072;
      return embeddingResponse(provider, Array.from({ length: count }, () => Array(dimensions).fill(0.5)));
    });
    await assert.rejects(generateEmbeddingsBatch(Array(101).fill("hello")), /expected 1024, received 3072/);
    assert.equal(upstream.mock.callCount(), 2);
  });
}

test("Gemini honors an explicit native model and output dimensionality", async (t) => {
  clearEmbeddingEnv(t);
  setEnv(t, {
    EMBEDDING_PROVIDER: "gemini",
    GOOGLE_GEMINI_API_KEY: "offline-gemini-key",
    GOOGLE_GEMINI_EMBEDDING_MODEL: "models/offline-gemini-model",
    EMBEDDING_DIMENSIONS: "768",
  });
  t.mock.method(globalThis, "fetch", async (input, init) => {
    assert.equal(String(input), "https://generativelanguage.googleapis.com/v1beta/models/offline-gemini-model:batchEmbedContents");
    const body = JSON.parse(init?.body as string);
    assert.equal(body.requests[0].model, "models/offline-gemini-model");
    assert.equal(body.requests[0].outputDimensionality, 768);
    assert.equal(body.requests[0].content.parts[0].text.length, 8000);
    return embeddingResponse("gemini", [Array(768).fill(0.5)]);
  });
  assert.deepEqual(await generateEmbedding("x".repeat(9000)), Array(768).fill(0.5));
});

test("Gemini rejects malformed response arrays and vector values", async (t) => {
  clearEmbeddingEnv(t);
  setEnv(t, { EMBEDDING_PROVIDER: "gemini", GOOGLE_GEMINI_API_KEY: "offline-gemini-key" });
  const responses = [{}, { embeddings: {} }, { embeddings: [null] }, { embeddings: [{ values: "invalid" }] }];
  const upstream = t.mock.method(globalThis, "fetch", async () => Response.json(responses.shift()));
  for (let i = 0; i < 4; i++) {
    await assert.rejects(generateEmbedding("hello"), /invalid embedding (count|vector)/);
  }
  assert.equal(upstream.mock.callCount(), 4);
});

test("Gemini rejects numeric overflow in a response", async (t) => {
  clearEmbeddingEnv(t);
  setEnv(t, { EMBEDDING_PROVIDER: "gemini", GOOGLE_GEMINI_API_KEY: "offline-gemini-key" });
  const json = JSON.stringify({ embeddings: [{ values: Array(1024).fill(0.5) }] }).replace("0.5", "1e999");
  t.mock.method(globalThis, "fetch", async () => new Response(json, { headers: { "Content-Type": "application/json" } }));
  await assert.rejects(generateEmbedding("hello"), /non-finite or non-numeric/);
});

for (const status of [429, 503]) {
  test(`Gemini retries HTTP ${status} without changing provider`, async (t) => {
    clearEmbeddingEnv(t);
    setEnv(t, { EMBEDDING_PROVIDER: "gemini", GOOGLE_GEMINI_API_KEY: "offline-gemini-key" });
    t.mock.method(console, "warn", () => {});
    let attempts = 0;
    const upstream = t.mock.method(globalThis, "fetch", async (input) => {
      assert.match(String(input), /:batchEmbedContents$/);
      attempts++;
      return attempts === 1
        ? new Response("private provider error", { status })
        : embeddingResponse("gemini", [Array(1024).fill(0.5)]);
    });
    assert.deepEqual(await generateEmbedding("hello"), Array(1024).fill(0.5));
    assert.equal(upstream.mock.callCount(), 2);
  });
}

test("Gemini authentication errors are sanitized and not retried", async (t) => {
  clearEmbeddingEnv(t);
  setEnv(t, { EMBEDDING_PROVIDER: "gemini", GOOGLE_GEMINI_API_KEY: "offline-gemini-key" });
  const upstream = t.mock.method(globalThis, "fetch", async () =>
    new Response("private provider error offline-gemini-key", { status: 401 })
  );
  await assert.rejects(generateEmbedding("hello"), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /HTTP 401/);
    assert.doesNotMatch(error.message, /private provider error|offline-gemini-key/);
    return true;
  });
  assert.equal(upstream.mock.callCount(), 1);
});

const CURRENT = { provider: "openai", model: "text-embedding-3-large", dimensions: 1024 } as const;

function tagged(provider: string, model: string, dimensions: number) {
  return { payload: { embeddingProvider: provider, embeddingModel: model, embeddingDimensions: dimensions } };
}

test("assertEmbeddingConsistency passes for matching tags and empty results", () => {
  assert.doesNotThrow(() => assertEmbeddingConsistency("repo-1", [], CURRENT));
  assert.doesNotThrow(() =>
    assertEmbeddingConsistency("repo-1", [tagged("openai", "text-embedding-3-large", 1024)], CURRENT)
  );
});

test("assertEmbeddingConsistency throws a re-ingest error on provider/model mismatch", () => {
  assert.throws(
    () =>
      assertEmbeddingConsistency(
        "repo-1",
        [tagged("gemini", "gemini-embedding-001", 1024)],
        CURRENT
      ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /Embedding model mismatch/);
      assert.match(error.message, /gemini\/gemini-embedding-001/);
      assert.match(error.message, /openai\/text-embedding-3-large/);
      assert.match(error.message, /Re-ingest the repository/);
      return true;
    }
  );
});

test("assertEmbeddingConsistency throws on dimension mismatch and legacy untagged vectors", () => {
  assert.throws(
    () => assertEmbeddingConsistency("repo-1", [tagged("openai", "text-embedding-3-large", 768)], CURRENT),
    /Embedding model mismatch.*Re-ingest the repository/s
  );
  assert.throws(
    () => assertEmbeddingConsistency("repo-1", [{ payload: { repoId: "repo-1" } }], CURRENT),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /predate embedding-model tracking/);
      assert.match(error.message, /Re-ingest the repository/);
      return true;
    }
  );
});
