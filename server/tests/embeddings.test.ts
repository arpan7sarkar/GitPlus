import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertEmbeddingConsistency,
  describeEmbedding,
  generateEmbedding,
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
  setEnv(t, { EMBEDDING_PROVIDER: "gemini", OPENAI_API_KEY: "offline-openai-key" });
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
  setEnv(t, { EMBEDDING_PROVIDER: "openai", OPENAI_API_KEY: "offline-openai-key" });
  // The OpenAI SDK requests base64-encoded vectors by default; use float32-exact
  // values so the decoded result compares strictly equal.
  const floats = [0.5, -1.25];
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

test("generateEmbedding calls Gemini when explicitly configured", async (t) => {
  clearEmbeddingEnv(t);
  setEnv(t, {
    EMBEDDING_PROVIDER: "gemini",
    GOOGLE_GEMINI_API_KEY: "offline-gemini-key",
    OPENAI_API_KEY: "offline-openai-key",
  });
  const floats = [0.5];
  const b64 = Buffer.from(new Float32Array(floats).buffer).toString("base64");
  const upstream = t.mock.method(globalThis, "fetch", async (input: unknown, init?: { body?: unknown }) => {
    assert.match(String(input), /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/openai\/embeddings/);
    const body = JSON.parse(init?.body as string);
    assert.equal(body.model, "gemini-embedding-001");
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
