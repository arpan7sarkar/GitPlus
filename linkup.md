# GitPlus Linkup Plan & Integration Audit

> **Document Status**: Master Architectural Roadmap & Comprehensive Feature Audit  
> **Target Goal**: Fully connect Next.js 16 frontend ([`frontend/`](file:///Users/devsouvik/Development/GitPlus/frontend)) with Node.js Express + Prisma + Actian Vector AI backend ([`server/`](file:///Users/devsouvik/Development/GitPlus/server)), migrating all capabilities from the old CodebaseGPT project ([`docs/`](file:///Users/devsouvik/Development/GitPlus/docs)) while retaining the new Tailwind v4 design system.

---

## 1. Architectural Overview & Context

Previously, **CodebaseGPT** ([`docs/`](file:///Users/devsouvik/Development/GitPlus/docs)) was a Vite + React 18 single-page application relying on Supabase Serverless Postgres and Deno Edge Functions.

The new **GitPlus** architecture moves to a dedicated multi-tier stack:
1. **Frontend**: Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + Zustand store + TanStack Query.
2. **Backend Server**: Node.js Express 5 API server (`server/src/index.ts`) listening on port 3000.
3. **Relational DB & ORM**: PostgreSQL database managed via **Prisma ORM** (`server/prisma/schema.prisma`).
4. **Vector Database**: **Actian Vector AI** DB (`@actian/vectorai-client`) for 1536-dimensional code chunk embeddings (`gitplus_code_chunks` collection).
5. **Search Engine**: **Hybrid Reciprocal Rank Fusion (RRF)** combining Actian dense vector search with Prisma BM25 keyword search.
6. **Authentication**: Clerk Backend (`@clerk/backend`) integration.

---

## 2. Comprehensive Feature & Page Migration Inventory

### 2.1 Complete Page Inventory (`docs/src/pages/` vs `frontend/app/`)

| Feature / Page | Old Location (`docs/src/pages/`) | New App Location (`frontend/app/`) | Backend Endpoint | Status & Requirements |
| :--- | :--- | :--- | :--- | :--- |
| **Landing & Repo Input** | `Landing.tsx` | `app/(marketing)/page.tsx` | `POST /api/repo/index`<br>`GET /api/visits/stats`<br>`POST /api/visits/track` | UI updated to Next.js; needs live stats & index triggers linked. |
| **Indexing Progress** | `IndexingProgress.tsx` | Indexing progress modal | `POST /api/repo/index` | Stage progress (1-4) needs state sync in Zustand `useRepoStore`. |
| **Repo Dashboard Overview** | `RepoDashboard.tsx` | `app/(app)/repo/[repoId]/page.tsx` | `POST /api/chat` (`action: "overview"`) | Overview narrative, framework, complexity, key files. |
| **AI Chat & Code QA** | `ChatInterface.tsx` | `app/(app)/repo/[repoId]/chat/page.tsx` | `POST /api/chat` (SSE stream) | Streaming chat with RAG, code citations & prompt presets. |
| **Interactive Dependency Graph** | `components/dashboard/DependencyGraph.tsx` | ❌ **Missing**: Component in Dashboard | Internal dependency parser / D3 | Interactive 2D graph (`react-force-graph-2d`) with node context menus. |
| **System Architecture Doc** | `SystemDesign.tsx` | `app/(app)/repo/[repoId]/system-design/page.tsx` | `POST /api/chat` (`action: "system-design"`) | Markdown 10-section system design generator. |
| **Security Audit Scan** | `SecurityScan.tsx` | `app/(app)/repo/[repoId]/security/page.tsx` | `POST /api/chat` (`action: "security"`) | Deterministic 12-category security finding scanner. |
| **GitHub Issues** | `RepoIssues.tsx` | `app/(app)/repo/[repoId]/issues/page.tsx` | `POST /api/repo/issues` | Filterable list of GitHub issues with expandable details. |
| **GitHub PRs & Diffs** | `RepoPRs.tsx` | `app/(app)/repo/[repoId]/prs/page.tsx` | `GET /api/repo/pulls`<br>`GET /api/repo/pulls/:pr/diff` | Pull requests list + unified diff text viewer. |
| **Commit Timeline** | `RepoCommits.tsx` | `app/(app)/repo/[repoId]/commits/page.tsx` | `GET /api/repo/commits` | History of recent 30 commits with GitHub links & `CommitDialog`. |
| **Onboarding Guide** | `OnboardingDoc.tsx` | `app/(app)/repo/[repoId]/onboarding/page.tsx` | `POST /api/chat` (`action: "onboarding"`) | Practical developer onboarding guide generator. |
| **Shared Chat View** | `SharedChat.tsx` | ❌ **Missing**: `app/(app)/shared/[sessionId]/page.tsx` | `GET /api/sessions/:id` | Read-only public chat session view from database. |
| **StackBlitz / IDE Launcher** | `lib/webcontainer.ts` | ❌ **Missing**: IDE launch helper | Third-party StackBlitz POST API | Opens indexed project in online StackBlitz WebContainer IDE. |
| **PDF & Markdown Export** | `lib/chat-session.ts` | ❌ **Missing**: Export helpers | Client-side jsPDF | PDF/Markdown export for chat transcripts & reports. |
| **Global Code Search Modal** | `CodebaseSearch.tsx` | ❌ **Missing**: Cmd+K overlay | `/api/search/hybrid` | Cmd+K global search shortcut overlay. |
| **Recent Repos Drawer** | `UserRepos.tsx` | ❌ **Missing**: Repo switcher drawer | LocalStorage / Clerk session | Quick switcher for previously indexed repositories. |
| **CLI & SDK Docs** | `CLIPage.tsx`, `SDKPage.tsx` | ❌ **Missing**: Static routes | Static docs | Documentation for CLI (`codebasegpt`) and SDK. |
| **Marketing Pages** | `Changelog.tsx`, `FAQ.tsx`, `Features.tsx`, `HowItWorks.tsx`, etc. | ❌ **Missing**: Subpages in `app/(marketing)/` | Static content | Info subpages linked in global footer. |

---

## 3. Backend Route & Frontend API Contract Mapping

### 3.1 Endpoint Contracts (`server/src/routes/` vs `frontend/lib/api.ts`)

| Express Route | HTTP Method | Expected Payload / Params | `frontend/lib/api.ts` Function | Status |
| :--- | :--- | :--- | :--- | :--- |
| `/api/repo/index` | `POST` | `{ githubUrl: string, githubToken?: string }` | `indexRepository()` | Connected |
| `/api/repo/file` | `POST` | `{ owner: string, repo: string, path: string, githubToken?: string }` | `fetchFileContent()` | Connected |
| `/api/repo/fetch-batch` | `POST` | `{ owner: string, repo: string, paths: string[], githubToken?: string }` | `fetchFilesBatch()` | Connected |
| `/api/chat` | `POST` | `{ messages: [], repoContext: string, action: string }` | `streamChat()`, `generateOverview()`, `generateSecurityScan()`, `generateSystemDesign()`, `generateOnboardingDoc()` | Connected |
| `/api/repo/issues` | `POST` | `{ owner: string, repo: string, state?: string, githubToken?: string }` | `fetchIssues()` | Connected |
| `/api/repo/pulls` | `GET` | Query: `owner`, `repo`, `state`, `githubToken` | `fetchPullRequests()` | Connected |
| `/api/repo/pulls/:pr/diff` | `GET` | Params: `pr`. Query: `owner`, `repo`, `githubToken` | `fetchPullRequestDiff()` | Connected |
| `/api/repo/commits` | `GET` | Query: `owner`, `repo`, `githubToken` | `fetchCommits()` | Connected |
| `/api/visits/track` | `POST` | `{ visitor_id: string }` | `trackVisit()` | Connected |
| `/api/visits/stats` | `GET` | None | `fetchStats()` | Connected |
| `/api/sessions` | `POST` | `{ repoId: string, repoMeta: {}, repoContext: "", userId?: string }` | ❌ Missing in UI | API exists on server |
| `/api/sessions/:id` | `GET` | Params: `id` | ❌ Missing in UI | Used for `/shared/:sessionId` |
| `/api/sessions/:id` | `PUT` | Params: `id`, Body: `{ messages: [] }` | ❌ Missing in UI | Updates chat session messages |
| `/api/search/ingest` | `POST` | `{ repoId: string, files: [{ path, content }] }` | ❌ Missing trigger in UI | Ingests chunks to Actian + Prisma |
| `/api/search/hybrid` | `POST` | `{ query: string, repoId: string, filter?: {} }` | ❌ Missing in Chat RAG | Hybrid RRF vector search |

---

## 4. Complete List of Gaps & Missing Capabilities

### 🚨 Detailed Problem Matrix

1. **Actian Vector AI Chunk Ingestion Unlinked**:
   - **Problem**: When `indexRepository` completes in `frontend`, code files are stored in `useRepoStore` memory, but `/api/search/ingest` is never called.
   - **Impact**: The Actian Vector AI database and Prisma `code_chunks` table remain empty after indexing.
   - **Solution Required**: Call `/api/search/ingest` immediately following a successful repository index.

2. **RAG Hybrid Search Integration in AI Chat**:
   - **Problem**: The chat route currently receives a raw concatenated `repoContext` string rather than querying Actian + Prisma via `/api/search/hybrid`.
   - **Impact**: Large codebases exceed LLM context windows or miss specific code references.
   - **Solution Required**: Update chat flow to trigger hybrid search to retrieve top code chunks before passing them to `/api/chat`.

3. **Interactive Dependency Graph Component (`DependencyGraph.tsx`)**:
   - **Problem**: `docs/src/components/dashboard/DependencyGraph.tsx` provided an interactive D3 / `react-force-graph-2d` visualization of module relationships with node context menus (`NodeContextMenu.tsx`).
   - **Impact**: Missing in the new `frontend/app/(app)/repo/[repoId]/page.tsx` tab bar.
   - **Solution Required**: Port `DependencyGraph.tsx` and `NodeContextMenu.tsx` into `frontend/components/app/DependencyGraph.tsx`.

4. **Shared Chat Session Route (`/shared/[sessionId]`)**:
   - **Problem**: Old codebase had `SharedChat.tsx` allowing users to generate and share public URLs for saved conversations (`/shared/:sessionId`).
   - **Impact**: Server endpoints (`/api/sessions`, `/api/sessions/:id`, `/api/sessions/:id` PUT) exist in `server/src/routes/sessions.ts`, but `frontend` lacks both the "Share Session" button and the Next.js page `app/(app)/shared/[sessionId]/page.tsx`.
   - **Solution Required**: Implement `app/(app)/shared/[sessionId]/page.tsx` and attach `POST /api/sessions` to the Share button.

5. **Online IDE Launcher (StackBlitz / WebContainer)**:
   - **Problem**: Old codebase had `openInStackBlitz` in `webcontainer.ts` to launch indexed repositories directly inside an online browser IDE.
   - **Impact**: Feature button is missing from the repository header.
   - **Solution Required**: Add `openInStackBlitz` helper in `frontend/lib/utils/stackblitz.ts` and attach to "Open in IDE" button.

6. **Cmd+K Global Code Search Modal (`CodebaseSearch.tsx`)**:
   - **Problem**: `docs/src/components/dashboard/CodebaseSearch.tsx` allowed pressing Cmd+K to search files, functions, and symbols.
   - **Impact**: Shortcut and overlay modal missing in `frontend`.
   - **Solution Required**: Implement global shortcut listener and overlay connecting to `/api/search/hybrid`.

7. **PDF & Markdown Export Tooling**:
   - **Problem**: Chat responses and security scan reports had one-click export as Markdown or PDF.
   - **Impact**: Export dropdown missing in `frontend`.
   - **Solution Required**: Integrate `jspdf` or markdown download helpers in `frontend/lib/utils/export.ts`.

8. **Live Health & Operational Latency Polling (`SystemHealth.tsx`)**:
   - **Problem**: System health indicator component polled `/health` every 30 seconds to show server status and response latency.
   - **Impact**: Missing from footer / navigation header in `frontend`.
   - **Solution Required**: Port `SystemHealth.tsx` using `useHealthStore` in `frontend/components/shared/SystemHealth.tsx`.

9. **GitHub Token Configuration**:
   - **Problem**: Heavy repository indexing or private repos hit GitHub's 60 req/hr rate limit if no token is provided.
   - **Impact**: Indexing fails with `HTTP 403 / Rate limit exceeded`.
   - **Solution Required**: Store `githubToken` in `useRepoStore` / `settings-store` and pass it down with every API call.

10. **On-Demand Mode File Fetching in File Tree UI**:
    - **Problem**: In on-demand mode (for repos > 300 files), only skeleton files are fetched initially.
    - **Impact**: Clicking an unfetched file in the file tree component must dynamically invoke `fetchFileContent` or `fetchFilesBatch` to load content into `fileContents` store.
    - **Solution Required**: Ensure the FileTree component triggers `fetchFileContent` when an unfetched node is clicked.

---

## 5. Sequential Step-by-Step Implementation Roadmap

### Phase 1: Base Connection & Environment Setup
- Ensure `server` is running (`npm run dev` in `server/`) on `http://localhost:3000`.
- Verify `/health` endpoint responds with `{ postgres: "connected", vectorai: "connected" }`.
- Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api` and `NEXT_PUBLIC_USE_MOCK=false` in `frontend/.env.local`.

### Phase 2: Indexing & Actian Vector AI Ingestion
- Ensure `indexRepository` in `frontend/lib/api.ts` correctly parses `repoId`, `fileTree`, `meta`, and `fileContents`.
- Post-indexing hook: In `frontend`, after `indexRepository` resolves, automatically invoke `fetch('/api/search/ingest')` with `{ repoId, files }` to populate Actian Vector AI & Prisma `code_chunks`.

### Phase 3: Interactive Visualizations & Tooling Port
- **Dependency Graph**: Port D3/ForceGraph visualizer (`DependencyGraph.tsx`) with node context menu (`NodeContextMenu.tsx`).
- **StackBlitz IDE Launcher**: Add "Open in IDE" button linking to StackBlitz POST API.
- **Global Code Search Modal**: Implement Cmd+K shortcut overlay calling `/api/search/hybrid`.
- **System Health Monitor**: Add `SystemHealth` latency indicator to header.

### Phase 4: Core Sub-Routes & Feature Tabs
- **Dashboard & Overview**: Verify `generateOverview` calls `/api/chat` with `action: "overview"` and renders narrative cards.
- **Security Audit**: Verify `generateSecurityScan` renders findings with severity color badges.
- **System Design**: Render Markdown system design output with code block syntax highlighting.
- **Onboarding Guide**: Render Markdown onboarding instructions.
- **Issues, PRs & Commits**: Verify filtering open/closed states and viewing PR unified diffs with `CommitDialog`.

### Phase 5: Shared Sessions & Vector Search RAG Chat
- Create `frontend/app/(app)/shared/[sessionId]/page.tsx`.
- Add "Share Session" button to `chat/page.tsx` calling `POST /api/sessions`.
- Enhance chat prompt generation to execute `/api/search/hybrid` when asking repository questions.
- Add PDF / Markdown export options to chat and reports.
