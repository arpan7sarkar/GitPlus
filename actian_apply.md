# GitPlus + Actian VectorAI Database

**How Actian's vector database made real hierarchical, semantic code search possible for GitPlus — and why it's the reason the retrieval actually works.**

---

## What we built

GitPlus turns a pasted GitHub URL into a codebase that can answer questions about itself — with cited, line-accurate context, pulled fresh on every single message, not a one-time summary stuffed into a prompt. On top of that same retrieval pipeline it generates onboarding guides, security audits, system-design docs, and full AI pull-request reviews (VexReview).

None of that is possible without a real vector database doing real semantic search. We built it on **Actian VectorAI Database**, and it is the load-bearing piece of the entire product — not a checkbox integration bolted on to satisfy a hackathon track requirement.

---

## Why Actian

We evaluated this against the standard "just use X" defaults, and Actian won on the things that actually mattered once we started building:

- **Self-hosted via Docker, running in minutes.** No waiting on a managed-cloud account, no per-seat pricing to unblock a teammate — `docker compose up -d` and the collection is live.
- **A real Console.** The Actian dashboard (Console, Collections browser, License Manager) at `localhost:6575` let us inspect the actual `gitplus_nodes_v3` collection while building — point counts, payload shape, filter behavior — instead of debugging blind against opaque API responses.
- **Payload filtering that's actually a first-class query primitive**, not a bolt-on post-filter. That one capability is what let us collapse four different granularities of code understanding into a single collection instead of managing four separate indexes.
- **A gRPC + REST client that exposes the primitives we needed** (dense search, filtered search, batch upsert, filtered delete) without forcing us into a rigid schema-first workflow before we knew what we were building.

## The problem Actian solved: hierarchical semantic search

Most RAG-over-code tools treat a repository as one flat pile of chunks. That fails in an obvious way: a broad question ("what does this app do?") and a narrow one ("where do we handle rate limiting?") need to match against completely different granularities of content. A flat index can't tell them apart.

We built **four tiers per repository** — `repo → module → file → symbol` — each one summarized and embedded independently:

| Tier | What's embedded |
|---|---|
| `repo` | One LLM-generated summary of the entire system |
| `module` | Summary of a directory's collective purpose (e.g. `src/lib/`) |
| `file` | LLM summary **plus** the full raw file content mirrored in Postgres |
| `symbol` | Individual functions, classes, methods — chunked by AST, never split mid-body |

All four tiers live in **one Actian collection** (`gitplus_nodes_v3`, 1024-dim, cosine distance), with `level` stored as a filterable payload field rather than a separate index per tier. That's a direct application of Actian's **Filtered Search** pattern: a vague question is searched with `level: repo|module` preferred, a specific one is searched with `level: symbol`, and both queries hit the exact same collection. This is the piece of the architecture Actian made possible — without real payload filtering as a query-time primitive, we'd have needed four separate vector stores and a fan-out query layer to get the same result.

## The second Actian pattern: Hybrid Fusion

Dense vector search alone misses things a developer would find instantly — an exact function name, an error string, a config key. So every query runs **two searches in parallel** and fuses them:

1. **Actian dense vector search** — top 25 candidates, semantic similarity, with the option to pull raw vectors back for re-ranking.
2. **Postgres BM25-style keyword search** — exact term matching, running alongside it.

The two ranked lists are combined with **Reciprocal Rank Fusion (k=60)**, using Actian's own `reciprocalRankFusion` helper where available. The fused pool then goes through **MMR (Maximal Marginal Relevance, λ=0.7)** re-ranking so the final context set handed to the LLM is diverse — not five near-duplicate chunks from the same file crowding out everything else.

This runs **on every single chat turn**, live against Actian, not as a static context blob computed once at index time.

## Building against the real server, not just the docs

Two integration issues surfaced only once we were pushing real data through Actian's server — the kind of thing that only shows up when a product actually gets used in anger:

1. **Point IDs must be valid UUIDs.** Our own node IDs (`repoId::path:startLine-endLine`) aren't UUID-shaped. We derive a deterministic SHA-256-based UUID as the Actian-side point ID and carry our real ID in the payload — so re-ingesting a repo idempotently *updates* the same points instead of duplicating them, and every layer above the storage client only ever sees our own IDs.
2. **Filters need a real `Field`/`Filter` object**, not a plain `{must: [...]}` dict — the SDK calls `.isEmpty()` on whatever it's handed. We build filters with `new Field(...).eq(...)`, chained with `.and(...)`, which the SDK's own class hierarchy expects.

Neither of these is a complaint — they're exactly the kind of sharp edges you find when a database is powerful enough to expose real primitives (typed filters, explicit ID space) instead of hiding everything behind a magic `.query(string)` call. We'd rather have that than a leaky abstraction.

## How Actian helped, concretely

- **Made the 4-tier hierarchy cheap to build.** One collection, one embedding model, one filterable field (`level`) — instead of orchestrating four indexes, we manage one.
- **Made hybrid search a real fusion, not a fallback.** Because Actian's dense search returns clean, filterable, rankable results, RRF-fusing it with keyword search was a small function, not a redesign.
- **Kept re-indexing safe.** Deterministic point IDs + Actian's filtered delete (`deleteByRepo`) mean re-ingesting a repo is idempotent — wipe-and-rebuild, never accumulating stale vectors.
- **Kept the whole pipeline inspectable.** Every stage of ingestion — from raw chunk to embedded point sitting in Actian — was visible in the Console while we debugged, which is the difference between fixing a bug in ten minutes and fixing it in an afternoon.
- **Let us ship the actual differentiator.** Because Actian's primitives handled storage, filtering, and fusion cleanly, our engineering time went into AST-aware chunking, the hierarchy, and MMR — the retrieval quality work — instead of vector-store plumbing.

## Where we're going next

We scoped **Named Vectors** (a second embedding space per point) as a way to let symbol-level and summary-level content live in independently-tuned spaces, and deprioritized it only because the `level`-filtered single-space design already solved the same problem well enough to ship. It's the natural next Actian feature for us to adopt as GitPlus scales past a single embedding model — and a big part of why we're applying: we want to keep building on Actian, not migrate off it.

GitPlus exists in its current form because Actian VectorAI Database made a genuinely hard retrieval problem — four granularities, two search modes, per-turn freshness — tractable with one collection and a handful of well-designed primitives. That's the whole pitch.
