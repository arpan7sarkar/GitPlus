import assert from "node:assert/strict";
import { test } from "node:test";
import { keywordSearch, reciprocalRankFusion } from "../src/lib/hybridSearch.js";
import type { NodePayload, SearchHit } from "../src/lib/pinecone.js";

const payload: NodePayload = {
  repoId: "test-repo",
  level: "symbol",
  filePath: "src/auth.ts",
  language: "typescript",
  category: "auth",
  symbolType: "function",
  startLine: 1,
  endLine: 5,
  lineRange: "1-5",
};

function hit(id: string, vector?: number[]): SearchHit {
  return { id, score: 0.9, payload, vector };
}

test("RRF merges duplicate IDs while preserving dense vectors for MMR", () => {
  const vector = [0.4, 0.6];
  const dense = [hit("dense-only", [1, 0]), hit("both", vector)];
  const sparse = [
    { id: "both", text: "auth", score: 8, payload },
    { id: "sparse-only", text: "auth", score: 1, payload },
  ];
  const results = reciprocalRankFusion(dense, sparse);
  assert.equal(results.length, 3);
  assert.equal(results[0].id, "both");
  assert.deepEqual(results[0].vector, vector);
  assert.equal(results[0].score, 1 / 62 + 1 / 61);
  assert.equal(results.find((r) => r.id === "sparse-only")?.vector, undefined);
});

test("RRF respects the rank constant and result limit", () => {
  const results = reciprocalRankFusion([hit("a"), hit("b"), hit("c")], [], 10, 2);
  assert.deepEqual(results.map((r) => r.id), ["a", "b"]);
  assert.equal(results[0].score, 1 / 11);
});

test("RRF handles empty dense and sparse results", () => {
  assert.deepEqual(reciprocalRankFusion([], []), []);
});

test("Keyword search ranks matches and treats regex metacharacters literally", () => {
  const candidates = [
    { id: "a", text: "foo.bar foo.bar", payload },
    { id: "b", text: "fooXbar", payload },
    { id: "c", text: "FOO.BAR", payload },
  ];
  assert.deepEqual(keywordSearch("foo.bar", candidates).map((r) => r.id), ["a", "c"]);
  assert.deepEqual(keywordSearch("an", candidates), []);
});
