/**
 * Hybrid Search Engine
 * Combines dense vector similarity search (Pinecone) with sparse keyword search (BM25 over Postgres metadata)
 * using Reciprocal Rank Fusion (RRF).
 */

import type { SearchHit } from "./pinecone.js";

export interface KeywordCandidate {
  id: string;
  text: string; // the same embeddingText that was embedded (code+context or summary) — keeps sparse/dense search aligned
  payload: SearchHit["payload"];
}

export interface KeywordHit extends KeywordCandidate {
  score: number;
}

/**
 * Keyword search (BM25-style term frequency) over node candidates
 */
export function keywordSearch(query: string, candidates: KeywordCandidate[]): KeywordHit[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (terms.length === 0) return [];

  const scored = candidates.map((c) => {
    const text = c.text.toLowerCase();
    let score = 0;
    for (const term of terms) {
      const matches = (text.match(new RegExp(escapeRegex(term), "gi")) || []).length;
      score += matches;
    }
    return { ...c, score };
  });

  return scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);
}

/**
 * Reciprocal Rank Fusion (RRF) algorithm (k=60).
 * `limit` defaults to 10 for plain search results, but retrieval.ts asks for a larger
 * pool (e.g. 25) so MMR has real candidates to diversify against before narrowing down.
 */
export function reciprocalRankFusion(
  vectorResults: SearchHit[],
  keywordResults: KeywordHit[],
  k = 60,
  limit = 10
): SearchHit[] {
  const scoreMap = new Map<string, { item: SearchHit; score: number }>();

  vectorResults.forEach((item, rank) => {
    const rrf = 1 / (k + rank + 1);
    scoreMap.set(item.id, { item, score: rrf });
  });

  keywordResults.forEach((item, rank) => {
    const rrf = 1 / (k + rank + 1);
    if (scoreMap.has(item.id)) {
      scoreMap.get(item.id)!.score += rrf;
    } else {
      scoreMap.set(item.id, {
        item: { id: item.id, score: item.score, payload: item.payload },
        score: rrf,
      });
    }
  });

  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((e) => ({ ...e.item, score: e.score }));
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
