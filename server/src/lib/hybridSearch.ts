/**
 * Hybrid Search Engine
 * Combines dense vector similarity search (Actian VectorAI) with sparse keyword search (BM25 over Neon Postgres metadata)
 * using Reciprocal Rank Fusion (RRF).
 */

import { reciprocalRankFusion as actianRRF } from "@actian/vectorai-client";
import type { SearchHit } from "./actian.js";

export interface KeywordHit {
  id: string;
  score: number;
  payload: SearchHit["payload"];
}

/**
 * Keyword search (BM25-style term frequency) over chunk candidates
 */
export function keywordSearch(
  query: string,
  candidates: { id: string; payload: SearchHit["payload"] }[]
): KeywordHit[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (terms.length === 0) return [];

  const scored = candidates.map((c) => {
    const text = [
      c.payload.codeSnippet,
      c.payload.filePath,
      c.payload.category,
      c.payload.symbolType,
    ]
      .join(" ")
      .toLowerCase();

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
 * Reciprocal Rank Fusion (RRF) algorithm (k=60 as recommended by Actian VectorAI docs)
 */
export function reciprocalRankFusion(
  vectorResults: SearchHit[],
  keywordResults: KeywordHit[],
  k = 60
): SearchHit[] {
  // If @actian/vectorai-client provides RRF function, we can use it or fall back to custom RRF calculation
  try {
    if (typeof actianRRF === "function") {
      const fused = actianRRF([
        vectorResults.map((item, rank) => ({ id: item.id, score: item.score, payload: item.payload, rank: rank + 1 })),
        keywordResults.map((item, rank) => ({ id: item.id, score: item.score, payload: item.payload, rank: rank + 1 })),
      ] as any);

      if (Array.isArray(fused) && fused.length > 0) {
        return fused.slice(0, 10).map((item: any) => ({
          id: String(item.id),
          score: item.score || item.rrfScore || 0,
          payload: item.payload,
        }));
      }
    }
  } catch {
    // Fallback to pure RRF calculation
  }

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
    .slice(0, 10)
    .map((e) => ({ ...e.item, score: e.score }));
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
