/**
 * Route: /api/search
 * Feature: Semantic Code Radar & Hybrid Search (Actian VectorAI + Neon Postgres BM25 Keyword Search with RRF)
 *
 * Endpoints:
 *   - POST /api/search/ingest - Ingests, chunks, embeds & indexes repo code files into Actian & Postgres
 *   - POST /api/search/hybrid - Performs hybrid RRF search combining dense vector search & sparse term matching
 */

import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { upsertChunks, vectorSearch, deleteByRepo } from "../lib/actian.js";
import { generateEmbedding, generateEmbeddingsBatch } from "../lib/embeddings.js";
import { chunkCodeFiles } from "../lib/chunker.js";
import { keywordSearch, reciprocalRankFusion } from "../lib/hybridSearch.js";

const router = Router();

// POST /api/search/ingest
router.post("/ingest", async (req: Request, res: Response) => {
  try {
    const { repoId, files } = req.body as {
      repoId: string;
      files: { path: string; content: string }[];
    };

    if (!repoId || !Array.isArray(files)) {
      return res.status(400).json({ error: "repoId string and files array are required" });
    }

    console.log(`[search-ingest] Ingesting ${files.length} files for repoId: ${repoId}`);

    // 1. Delete previous Actian vectors and Postgres metadata for this repoId
    await deleteByRepo(repoId);
    await prisma.codeChunk.deleteMany({ where: { repoId } });

    // 2. Chunk files into 40-line overlapping windows
    const chunks = chunkCodeFiles(files, repoId);
    if (chunks.length === 0) {
      return res.json({ success: true, count: 0 });
    }

    // 3. Batch embed snippets with OpenAI text-embedding-3-small (100 at a time)
    const snippets = chunks.map((c) => c.codeSnippet);
    const embeddings = await generateEmbeddingsBatch(snippets);

    // 4. Upsert into Actian VectorAI database
    await upsertChunks(
      chunks.map((c, i) => ({
        id: c.id,
        vector: embeddings[i],
        payload: {
          repoId: c.repoId,
          filePath: c.filePath,
          codeSnippet: c.codeSnippet,
          language: c.language,
          category: c.category,
          symbolType: c.symbolType,
          startLine: c.startLine,
          endLine: c.endLine,
          lineRange: `${c.startLine}-${c.endLine}`,
        },
      }))
    );

    // 5. Mirror chunk metadata in Neon Postgres for sparse keyword search
    await prisma.codeChunk.createMany({
      data: chunks.map((c) => ({
        id: c.id,
        repoId: c.repoId,
        filePath: c.filePath,
        codeSnippet: c.codeSnippet,
        startLine: c.startLine,
        endLine: c.endLine,
        language: c.language,
        symbolType: c.symbolType,
        category: c.category,
        contentHash: c.contentHash,
      })),
      skipDuplicates: true,
    });

    console.log(`[search-ingest] Successfully ingested ${chunks.length} code chunks for repoId: ${repoId}`);
    return res.json({ success: true, count: chunks.length });
  } catch (err: any) {
    console.error("[search-ingest error]:", err);
    return res.status(500).json({ error: err.message || "Failed to ingest codebase chunks" });
  }
});

// POST /api/search/hybrid
router.post("/hybrid", async (req: Request, res: Response) => {
  try {
    const { query, repoId, filter } = req.body as {
      query: string;
      repoId: string;
      filter?: { category?: string; language?: string };
    };

    if (!query || !repoId) {
      return res.status(400).json({ error: "query and repoId string parameters are required" });
    }

    // 1. Embed search query
    const queryVector = await generateEmbedding(query);

    // 2. Dense vector search in Actian VectorAI
    const actianFilter: Record<string, string> = { repoId };
    if (filter?.category) actianFilter.category = filter.category;
    if (filter?.language) actianFilter.language = filter.language;

    const vectorResults = await vectorSearch(queryVector, actianFilter, 10);

    // 3. Sparse keyword search over Neon Postgres code_chunks metadata
    const dbChunks = await prisma.codeChunk.findMany({
      where: {
        repoId,
        ...(filter?.category ? { category: filter.category } : {}),
        ...(filter?.language ? { language: filter.language } : {}),
      },
      select: {
        id: true,
        filePath: true,
        codeSnippet: true,
        category: true,
        symbolType: true,
        startLine: true,
        endLine: true,
        language: true,
      },
    });

    const keywordCandidates = dbChunks.map((c) => ({
      id: c.id,
      payload: {
        repoId,
        filePath: c.filePath,
        codeSnippet: c.codeSnippet,
        category: c.category,
        symbolType: c.symbolType,
        language: c.language,
        startLine: c.startLine,
        endLine: c.endLine,
        lineRange: `${c.startLine}-${c.endLine}`,
      },
    }));

    const keywordResults = keywordSearch(query, keywordCandidates);

    // 4. Fuse vector search & keyword search with Reciprocal Rank Fusion (RRF, k=60)
    const fusedResults = reciprocalRankFusion(vectorResults, keywordResults);

    return res.json({
      results: fusedResults.slice(0, 10).map((r) => ({
        id: r.id,
        filePath: r.payload.filePath,
        codeSnippet: r.payload.codeSnippet,
        startLine: r.payload.startLine,
        endLine: r.payload.endLine,
        score: r.score,
        category: r.payload.category,
        language: r.payload.language,
        symbolType: r.payload.symbolType,
      })),
    });
  } catch (err: any) {
    console.error("[search-hybrid error]:", err);
    return res.status(500).json({ error: err.message || "Hybrid search failed" });
  }
});

export default router;
