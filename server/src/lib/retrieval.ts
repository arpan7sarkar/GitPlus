/**
 * Query-time Retrieval for RAG
 * Shared by /api/search/hybrid (returns raw ranked results to the Search UI) and
 * /api/chat (builds LLM-ready context for a conversational answer). Retrieval
 * runs fresh on every call — real per-turn RAG, not a static context blob decided
 * once at index time.
 *
 * Pipeline: dense (Pinecone) + sparse (Postgres keyword) -> RRF fusion over a wide
 * candidate pool -> MMR (Max Marginal Relevance) re-ranking down to the final set,
 * so the LLM gets diverse, non-redundant chunks instead of several near-duplicate
 * hits from the same file crowding out everything else -> parent-context expansion
 * (small-to-big) for each surviving chunk.
 *
 * Embedding consistency: every stored vector is tagged with its origin model at
 * ingest time, and the dense hits (plus any tagged Postgres mirror rows) are
 * verified against the currently configured embedding model before fusion. A
 * mismatch — e.g. a repo ingested with Gemini embeddings queried with OpenAI —
 * throws a clear re-ingest error instead of returning meaningless neighbours.
 * Pre-migration repos with untagged Postgres nodes and no Pinecone vectors
 * (Actian-era vectors never migrated) are likewise rejected with a re-ingest
 * error rather than silently degrading to keyword-only results; genuinely
 * unindexed repos with no stored nodes keep their normal empty results.
 */

import { prisma } from "./prisma.js";
import { vectorSearch, type SearchHit, type NodeLevel } from "./pinecone.js";
import { assertEmbeddingConsistency, assertLegacyPineconeCoverage, generateEmbedding, getEmbeddingConfig } from "./embeddings.js";
import { keywordSearch, reciprocalRankFusion } from "./hybridSearch.js";

export interface RetrievedChunk {
  id: string;
  level: NodeLevel;
  filePath: string | null;
  symbolName: string | null;
  parentSymbolPath: string | null;
  symbolType: string | null;
  language: string | null;
  category: string | null;
  startLine: number | null;
  endLine: number | null;
  score: number;
  text: string; // code for symbol-level hits, summary for file/module/repo-level hits
  parentContext: { level: string; filePath: string | null; summary: string | null } | null;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  contextText: string;
}

const FETCH_K = 25; // candidate pool fused by RRF, before MMR narrows it down
const DEFAULT_FINAL_K = 8; // chunks actually handed to the LLM
const MMR_LAMBDA = 0.7; // 1.0 = pure relevance, 0.0 = pure diversity

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

/**
 * Greedy MMR selection. Candidates without a vector (keyword-only hits that never
 * matched a dense result) can't be diversity-scored against the others, so they're
 * treated as similarity-0 to everything already picked — they still compete on
 * relevance, just without the diversity penalty/benefit.
 */
function mmrSelect(candidates: SearchHit[], k: number, lambda: number): SearchHit[] {
  const maxScore = Math.max(...candidates.map((c) => c.score), 1e-8);
  const pool = [...candidates];
  const selected: SearchHit[] = [];

  while (selected.length < k && pool.length > 0) {
    let bestIdx = 0;
    let bestMmr = -Infinity;

    for (let i = 0; i < pool.length; i++) {
      const c = pool[i];
      const relevance = c.score / maxScore;
      const maxSim =
        selected.length === 0 || !c.vector
          ? 0
          : Math.max(...selected.map((s) => (s.vector ? cosineSim(c.vector!, s.vector) : 0)));
      const mmr = lambda * relevance - (1 - lambda) * maxSim;
      if (mmr > bestMmr) {
        bestMmr = mmr;
        bestIdx = i;
      }
    }

    selected.push(pool[bestIdx]);
    pool.splice(bestIdx, 1);
  }

  return selected;
}

function formatChunk(c: RetrievedChunk): string {
  if (c.level === "symbol") {
    const label = c.parentSymbolPath ? `${c.parentSymbolPath}.${c.symbolName}` : c.symbolName;
    const header = `### ${c.filePath}:${c.startLine}-${c.endLine} — ${c.symbolType} \`${label}\``;
    const fence = "```" + (c.language || "");
    const parentNote = c.parentContext?.summary ? `\n(File context: ${c.parentContext.summary})` : "";
    return `${header}\n${fence}\n${c.text}\n\`\`\`${parentNote}`;
  }
  // file/module/repo level hits are summaries, not raw code
  const header = `### ${c.filePath || "(repository)"} — ${c.level} summary`;
  return `${header}\n${c.text}`;
}

export async function retrieveForQuery(
  query: string,
  repoId: string,
  opts?: { level?: NodeLevel; category?: string; language?: string; k?: number }
): Promise<RetrievalResult> {
  const k = opts?.k ?? DEFAULT_FINAL_K;

  const queryVector = await generateEmbedding(query);

  const pineconeFilter: Record<string, string> = { repoId };
  if (opts?.level) pineconeFilter.level = opts.level;
  if (opts?.category) pineconeFilter.category = opts.category;
  if (opts?.language) pineconeFilter.language = opts.language;

  const dbWhere = {
    repoId,
    ...(opts?.level ? { level: opts.level } : {}),
    ...(opts?.category ? { category: opts.category } : {}),
    ...(opts?.language ? { language: opts.language } : {}),
  };

  const [denseResults, dbNodes] = await Promise.all([
    vectorSearch(queryVector, pineconeFilter, FETCH_K, true),
    prisma.node.findMany({
      where: dbWhere,
      select: {
        id: true,
        level: true,
        parentId: true,
        filePath: true,
        symbolName: true,
        parentSymbolPath: true,
        symbolType: true,
        language: true,
        startLine: true,
        endLine: true,
        code: true,
        summary: true,
        embeddingText: true,
        category: true,
        embeddingProvider: true,
        embeddingModel: true,
        embeddingDimensions: true,
      },
    }),
  ]);

  // Fail fast when the index holds vectors from a different embedding model
  // than the query was embedded with (or legacy untagged vectors, e.g. repos
  // ingested with Gemini embeddings while queries now use OpenAI) — fusing
  // them would silently return meaningless neighbours. The Postgres check only
  // looks at rows that actually carry origin tags: untagged mirror rows prove
  // nothing on their own (keyword search needs no vectors), while the Pinecone
  // check above governs untagged stored vectors.
  const embeddingConfig = getEmbeddingConfig();
  assertEmbeddingConsistency(repoId, denseResults, embeddingConfig);
  assertEmbeddingConsistency(
    repoId,
    dbNodes
      .map((n) => ({
        payload: {
          embeddingProvider: n.embeddingProvider,
          embeddingModel: n.embeddingModel,
          embeddingDimensions: n.embeddingDimensions,
        },
      }))
      .filter(
        (h) =>
          h.payload.embeddingProvider != null ||
          h.payload.embeddingModel != null ||
          h.payload.embeddingDimensions != null
      ),
    embeddingConfig
  );

  // Pre-migration repositories hold untagged Postgres nodes while Pinecone
  // holds no vectors for the repo (Actian-era vectors were never migrated).
  // Both checks above pass in that state (empty dense input is accepted, and
  // untagged rows are filtered out of the tagged check), so without this the
  // request silently degrades to keyword-only results. Throw a re-ingest
  // error instead — except for genuinely unindexed repos with no stored
  // nodes, which keep their normal empty results.
  assertLegacyPineconeCoverage(repoId, denseResults, dbNodes, embeddingConfig);

  const dbNodeById = new Map(dbNodes.map((n) => [n.id, n]));

  const keywordCandidates = dbNodes.map((n) => ({
    id: n.id,
    text: n.embeddingText,
    payload: {
      repoId,
      level: n.level,
      filePath: n.filePath || "",
      language: n.language || "",
      category: "",
      symbolType: n.symbolType || "",
      startLine: n.startLine || 0,
      endLine: n.endLine || 0,
      lineRange: n.startLine && n.endLine ? `${n.startLine}-${n.endLine}` : "",
    },
  }));

  const keywordResults = keywordSearch(query, keywordCandidates);
  const fused = reciprocalRankFusion(denseResults, keywordResults, 60, FETCH_K);
  const selected = mmrSelect(fused, k, MMR_LAMBDA);

  const parentIds = Array.from(
    new Set(selected.map((r) => dbNodeById.get(r.id)?.parentId).filter((id): id is string => Boolean(id)))
  );
  const parents = parentIds.length
    ? await prisma.node.findMany({ where: { id: { in: parentIds } }, select: { id: true, level: true, filePath: true, summary: true } })
    : [];
  const parentById = new Map(parents.map((p) => [p.id, p]));

  const chunks: RetrievedChunk[] = selected
    .map((r) => {
      const node = dbNodeById.get(r.id);
      if (!node) return null;
      const parent = node.parentId ? parentById.get(node.parentId) : undefined;
      return {
        id: node.id,
        level: node.level as NodeLevel,
        filePath: node.filePath,
        symbolName: node.symbolName,
        parentSymbolPath: node.parentSymbolPath,
        symbolType: node.symbolType,
        language: node.language,
        category: node.category,
        startLine: node.startLine,
        endLine: node.endLine,
        score: r.score,
        text: node.code ?? node.summary ?? "",
        parentContext: parent ? { level: String(parent.level), filePath: parent.filePath, summary: parent.summary } : null,
      } satisfies RetrievedChunk;
    })
    .filter((c): c is RetrievedChunk => c !== null);

  const contextText = chunks.map(formatChunk).join("\n\n");

  return { chunks, contextText };
}
