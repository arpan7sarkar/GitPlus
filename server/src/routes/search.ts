/**
 * Route: /api/search
 * Feature: Hierarchical Semantic Code Search (Actian VectorAI + Neon Postgres BM25 Keyword Search with RRF)
 *
 * Ingest builds a 4-tier hierarchy per repo — repo -> module -> file -> symbol —
 * and embeds every tier (text-embedding-3-large @ 1024 dims) into one Actian
 * collection with `level` as a filterable payload field. Hybrid search fuses
 * Actian's dense results with Postgres sparse keyword results, then expands each
 * hit with its immediate parent's summary for extra context.
 *
 * Endpoints:
 *   - POST /api/search/ingest - Chunks, summarizes, embeds & indexes a repo into Actian & Postgres
 *   - POST /api/search/hybrid - Performs hybrid RRF search combining dense vector search & sparse term matching
 */

import path from "path";
import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { upsertChunks, deleteByRepo, type NodeLevel, type NodePayload } from "../lib/actian.js";
import { generateEmbeddingsBatch } from "../lib/embeddings.js";
import { chunkCodeFiles, detectCategory, hash, type FileNode, type SymbolChunk } from "../lib/chunker.js";
import { summarizeFile, summarizeModule, summarizeRepo, mapWithConcurrency } from "../lib/summarize.js";
import { retrieveForQuery } from "../lib/retrieval.js";
import { getSessionUser, readSessionToken } from "../lib/auth.js";

const router = Router();

const SUMMARY_CONCURRENCY = 5;

interface NodeRow {
  id: string;
  repoId: string;
  level: NodeLevel;
  parentId: string | null;
  filePath: string | null;
  symbolName: string | null;
  parentSymbolPath: string | null;
  symbolType: string | null;
  language: string | null;
  startLine: number | null;
  endLine: number | null;
  code: string | null;
  content: string | null;
  summary: string | null;
  embeddingText: string;
  category: string | null;
  contentHash: string;
}

function toPayload(row: NodeRow): NodePayload {
  return {
    repoId: row.repoId,
    level: row.level,
    filePath: row.filePath || "",
    language: row.language || "",
    category: row.category || "utility",
    symbolType: row.symbolType || "",
    startLine: row.startLine || 0,
    endLine: row.endLine || 0,
    lineRange: row.startLine && row.endLine ? `${row.startLine}-${row.endLine}` : "",
  };
}

// POST /api/search/ingest
router.post("/ingest", async (req: Request, res: Response) => {
  try {
    const { repoId, files, repoMeta } = req.body as {
      repoId: string;
      files: { path: string; content: string }[];
      repoMeta?: {
        name?: string;
        owner?: string;
        description?: string;
        language?: string;
        stars?: number;
        forks?: number;
      };
    };

    if (!repoId || !Array.isArray(files)) {
      return res.status(400).json({ error: "repoId string and files array are required" });
    }

    console.log(`[search-ingest] Ingesting ${files.length} files for repoId: ${repoId}`);

    // 1. Wipe previous data for this repoId (idempotent re-index)
    await deleteByRepo(repoId);
    await prisma.node.deleteMany({ where: { repoId } });

    // 2. Symbol-aware chunking (AST where supported, boundary-snapped fallback otherwise)
    const { fileNodes, symbolChunks } = await chunkCodeFiles(files, repoId);
    if (fileNodes.length === 0) {
      return res.json({ success: true, count: 0 });
    }

    const symbolsByFile = new Map<string, SymbolChunk[]>();
    for (const c of symbolChunks) {
      if (!symbolsByFile.has(c.filePath)) symbolsByFile.set(c.filePath, []);
      symbolsByFile.get(c.filePath)!.push(c);
    }

    // 3. File-level LLM summaries (one per file, bounded concurrency)
    const fileSummaries = await mapWithConcurrency(fileNodes, SUMMARY_CONCURRENCY, async (fn: FileNode) => {
      const symbolLabels = (symbolsByFile.get(fn.filePath) || []).map((c) =>
        c.parentSymbolPath ? `${c.parentSymbolPath}.${c.symbolName}` : c.symbolName
      );
      const summary = await summarizeFile(fn.filePath, fn.content, symbolLabels);
      return { fileNode: fn, summary };
    });

    // 4. Module-level summaries — one per directory, from its files' summaries
    const moduleMap = new Map<string, { path: string; summary: string }[]>();
    for (const { fileNode, summary } of fileSummaries) {
      const modulePath = path.posix.dirname(fileNode.filePath.replace(/\\/g, "/")) || ".";
      if (!moduleMap.has(modulePath)) moduleMap.set(modulePath, []);
      moduleMap.get(modulePath)!.push({ path: fileNode.filePath, summary });
    }

    const moduleEntries = Array.from(moduleMap.entries());
    const moduleSummaries = await mapWithConcurrency(moduleEntries, SUMMARY_CONCURRENCY, async ([modulePath, fs]) => {
      const summary = fs.length === 1 ? fs[0].summary : await summarizeModule(modulePath, fs);
      return { modulePath, summary, fileSummaries: fs };
    });

    // 5. Repo-level summary — one per repo, from its modules' summaries
    const meta = {
      name: repoMeta?.name || repoId,
      description: repoMeta?.description || "",
      language: repoMeta?.language || "",
    };
    const repoSummary = await summarizeRepo(
      meta,
      moduleSummaries.map((m) => ({ path: m.modulePath, summary: m.summary }))
    );

    // 6. Assemble the full node hierarchy
    const repoNodeId = `${repoId}::repo`;
    const moduleNodeId = (modulePath: string) => `${repoId}::module:${modulePath}`;

    const nodes: NodeRow[] = [];

    nodes.push({
      id: repoNodeId,
      repoId,
      level: "repo",
      parentId: null,
      filePath: null,
      symbolName: null,
      parentSymbolPath: null,
      symbolType: null,
      language: meta.language || null,
      startLine: null,
      endLine: null,
      code: null,
      content: null,
      summary: repoSummary,
      embeddingText: repoSummary,
      category: detectCategory(repoSummary),
      contentHash: hash(repoSummary),
    });

    for (const { modulePath, summary } of moduleSummaries) {
      nodes.push({
        id: moduleNodeId(modulePath),
        repoId,
        level: "module",
        parentId: repoNodeId,
        filePath: modulePath,
        symbolName: null,
        parentSymbolPath: null,
        symbolType: null,
        language: null,
        startLine: null,
        endLine: null,
        code: null,
        content: null,
        summary,
        embeddingText: summary,
        category: detectCategory(summary),
        contentHash: hash(summary),
      });
    }

    for (const { fileNode, summary } of fileSummaries) {
      const modulePath = path.posix.dirname(fileNode.filePath.replace(/\\/g, "/")) || ".";
      nodes.push({
        id: fileNode.id,
        repoId,
        level: "file",
        parentId: moduleNodeId(modulePath),
        filePath: fileNode.filePath,
        symbolName: null,
        parentSymbolPath: null,
        symbolType: null,
        language: fileNode.language,
        startLine: null,
        endLine: null,
        code: null,
        content: fileNode.content,
        summary,
        embeddingText: summary,
        category: detectCategory(summary),
        contentHash: hash(fileNode.content),
      });
    }

    for (const c of symbolChunks) {
      nodes.push({
        id: c.id,
        repoId,
        level: "symbol",
        parentId: c.parentId,
        filePath: c.filePath,
        symbolName: c.symbolName,
        parentSymbolPath: c.parentSymbolPath,
        symbolType: c.symbolType,
        language: c.language,
        startLine: c.startLine,
        endLine: c.endLine,
        code: c.code,
        content: null,
        summary: null,
        embeddingText: c.embeddingText,
        category: c.category,
        contentHash: c.contentHash,
      });
    }

    // 7. Embed every tier in one batch pass (text-embedding-3-large @ 1024 dims)
    const embeddings = await generateEmbeddingsBatch(nodes.map((n) => n.embeddingText));

    // 8. Upsert into Actian VectorAI (single collection, `level` filterable in payload)
    await upsertChunks(
      nodes.map((n, i) => ({
        id: n.id,
        vector: embeddings[i],
        payload: toPayload(n),
      }))
    );

    // 9. Mirror the full hierarchy into Postgres (parent must exist before children — order matters for the FK)
    await prisma.node.createMany({ data: nodes as any, skipDuplicates: true });

    console.log(
      `[search-ingest] Indexed ${nodes.length} nodes for repoId: ${repoId} ` +
        `(1 repo, ${moduleSummaries.length} modules, ${fileNodes.length} files, ${symbolChunks.length} symbols)`
    );

    // 10. If the requester is logged in, record this repo against their account
    // (powers the "My Repos" page — the Node hierarchy above has no userId,
    // it's keyed only by repoId, so this is the only user<->repo association).
    // Non-fatal: the expensive work above (embeddings, Actian, Postgres nodes)
    // already succeeded by this point, so a failure here shouldn't turn the
    // whole ingest into an error — it would just mean re-indexing is needed to
    // pick the repo up in the list.
    if (repoMeta?.owner && repoMeta?.name) {
      try {
        const user = await getSessionUser(readSessionToken(req));
        if (user) {
          await prisma.indexedRepo.upsert({
            where: { userId_repoId: { userId: user.id, repoId } },
            create: {
              userId: user.id,
              repoId,
              owner: repoMeta.owner,
              name: repoMeta.name,
              description: repoMeta.description || null,
              language: repoMeta.language || null,
              stars: repoMeta.stars ?? null,
              forks: repoMeta.forks ?? null,
            },
            update: {
              description: repoMeta.description || null,
              language: repoMeta.language || null,
              stars: repoMeta.stars ?? null,
              forks: repoMeta.forks ?? null,
              lastIndexedAt: new Date(),
            },
          });
        }
      } catch (err) {
        console.error("[search-ingest] Failed to record IndexedRepo (non-fatal):", err);
      }
    }

    return res.json({ success: true, count: nodes.length });
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
      filter?: { category?: string; language?: string; level?: NodeLevel };
    };

    if (!query || !repoId) {
      return res.status(400).json({ error: "query and repoId string parameters are required" });
    }

    // Dense (Actian) + sparse (Postgres) fusion, MMR-diversified, parent-expanded —
    // same retrieval pipeline /api/chat uses internally for RAG.
    const { chunks } = await retrieveForQuery(query, repoId, {
      level: filter?.level,
      category: filter?.category,
      language: filter?.language,
      k: 10,
    });

    return res.json({
      results: chunks.map((c) => ({
        id: c.id,
        filePath: c.filePath,
        codeSnippet: c.text,
        startLine: c.startLine,
        endLine: c.endLine,
        score: c.score,
        category: c.category,
        language: c.language,
        symbolType: c.symbolType,
        level: c.level,
        parentContext: c.parentContext,
      })),
    });
  } catch (err: any) {
    console.error("[search-hybrid error]:", err);
    return res.status(500).json({ error: err.message || "Hybrid search failed" });
  }
});

export default router;
