/**
 * API Service Layer — GitPlus Frontend ↔ Express Backend
 *
 * All functions call the Express server at /api/* endpoints.
 * In development, Vite's proxy forwards these to http://localhost:3000.
 * In production, set VITE_API_BASE_URL to the deployed server URL.
 */

import type {
  IndexedRepo,
  SecurityFinding,
  GitHubIssue,
  GitHubPullRequest,
  GitHubCommit,
  RepoFileContent,
  BatchFetchResult,
  OverviewData,
  SearchResult,
  HybridSearchResponse,
  IngestResponse,
  HealthResponse,
  ChatSessionData,
  VisitStats,
} from "@/types/backend";

// Re-export backend data types for convenience across the app
export type {
  IndexedRepo,
  SecurityFinding,
  GitHubIssue,
  GitHubPullRequest,
  GitHubCommit,
  RepoFileContent,
  BatchFetchResult,
  OverviewData,
  SearchResult,
  HybridSearchResponse,
  IngestResponse,
  HealthResponse,
  ChatSessionData,
  VisitStats,
};

// In dev, the Vite proxy handles /api → localhost:3000 so we can use relative URLs.
// In production, set VITE_API_BASE_URL to the full server URL (e.g. https://api.gitplus.dev/api).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

// Resolve base URL: strip trailing slash for consistent path joining
const BASE = API_BASE_URL.replace(/\/+$/, "");

// ─── Helper ────────────────────────────────────────────────────────────────────

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    credentials: "include", // sends the gitplus_session cookie set by GitHub OAuth login
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(errBody.error || errBody.message || `Request failed: ${res.status}`);
  }

  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Repository Indexing
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/repo/index — Indexes a GitHub repository.
 */
export async function indexRepository(
  githubUrl: string,
  githubToken?: string,
  onProgress?: (stage: number, message: string) => void
): Promise<IndexedRepo> {
  onProgress?.(1, "Connecting to repository...");

  const res = await fetch(`${BASE}/repo/index`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ githubUrl, githubToken }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(errBody.error || "Failed to index repository");
  }

  const data = await res.json();

  // The server may return an error in the body (non-HTTP error)
  if (data.error) {
    throw new Error(data.error);
  }

  onProgress?.(4, "Indexing complete.");
  return data as IndexedRepo;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI Chat & Actions (all go through POST /api/chat with different `action` values)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/chat with action: "overview" — Generates repository overview.
 * Server returns { content: "JSON string" } — we parse the inner JSON.
 */
export async function generateOverview(repoContext: string): Promise<OverviewData> {
  const res = await apiRequest<{ content: string }>("/chat", {
    method: "POST",
    body: JSON.stringify({
      messages: [],
      repoContext,
      action: "overview",
    }),
  });

  // The server returns the overview as a JSON string inside `content`
  try {
    return JSON.parse(res.content) as OverviewData;
  } catch {
    // If parsing fails, return a basic structure from the raw content
    return {
      narrative: res.content,
      framework: "Unknown",
      complexity: "Unknown",
      suggestedQs: [],
      keyFiles: [],
      keyPatterns: [],
      mainDeps: [],
      languages: [],
    };
  }
}

/**
 * POST /api/chat with action: "security" — Security audit scan.
 * Server returns { content: "JSON array string" }.
 */
export async function generateSecurityScan(repoContext: string): Promise<SecurityFinding[]> {
  const res = await apiRequest<{ content: string }>("/chat", {
    method: "POST",
    body: JSON.stringify({
      messages: [],
      repoContext,
      action: "security",
    }),
  });

  try {
    return JSON.parse(res.content) as SecurityFinding[];
  } catch {
    return [];
  }
}

/**
 * POST /api/chat with action: "system-design" — System design documentation.
 * Server returns { content: "markdown string" }.
 */
export async function generateSystemDesign(repoContext: string): Promise<string> {
  const res = await apiRequest<{ content: string }>("/chat", {
    method: "POST",
    body: JSON.stringify({
      messages: [],
      repoContext,
      action: "system-design",
    }),
  });

  return res.content;
}

/**
 * POST /api/chat with action: "onboarding" — Onboarding documentation.
 * Server returns { content: "markdown string" }.
 */
export async function generateOnboardingDoc(repoContext: string): Promise<string> {
  const res = await apiRequest<{ content: string }>("/chat", {
    method: "POST",
    body: JSON.stringify({
      messages: [],
      repoContext,
      action: "onboarding",
    }),
  });

  return res.content;
}

/**
 * POST /api/chat with action: "chat" — SSE streaming chat.
 * Server responds with text/event-stream.
 *
 * When `repoId` is passed, the server runs real per-turn RAG: it retrieves
 * chunks relevant to the latest message fresh on every call (dense + sparse
 * fusion, MMR-diversified, parent-expanded) instead of reusing a single static
 * `repoContext` blob for the whole conversation. `repoContext` is still sent
 * as a fallback for repos that haven't been indexed into the search DB yet.
 */
export async function streamChat(params: {
  messages: Array<{ role: string; content: string }>;
  repoContext?: string;
  repoId?: string;
  onDelta?: (chunk: string) => void;
  onDone?: () => void;
  onError?: (error: string) => void;
}) {
  const processChunk = (json: any) => {
    const content = json.choices?.[0]?.delta?.content;
    if (content) params.onDelta?.(content);
  };

  try {
    const res = await fetch(`${BASE}/chat`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: params.messages,
        repoContext: params.repoContext || "",
        repoId: params.repoId,
        action: "chat",
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(errBody.error || "Chat request failed");
    }

    const reader = res.body?.getReader();
    if (!reader) {
      params.onDone?.();
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE lines: "data: {...}\n\n"
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete last line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;

        if (trimmed.startsWith("data: ")) {
          try {
            processChunk(JSON.parse(trimmed.slice(6)));
          } catch {
            // Not valid JSON SSE — might be raw text stream, pass through
            params.onDelta?.(trimmed.slice(6));
          }
        }
      }
    }

    // Flush remaining buffer
    if (buffer.trim() && buffer.trim() !== "data: [DONE]") {
      const trimmed = buffer.trim();
      if (trimmed.startsWith("data: ")) {
        try {
          processChunk(JSON.parse(trimmed.slice(6)));
        } catch {
          // pass
        }
      }
    }

    params.onDone?.();
  } catch (e) {
    params.onError?.(e instanceof Error ? e.message : "Chat request failed");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GitHub Data: Issues, PRs, Commits
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/repo/issues — Fetches repository issues.
 * Server returns { issues: [...] }.
 */
export async function fetchIssues(
  owner: string,
  repo: string,
  state: "open" | "closed" = "open",
  githubToken?: string
): Promise<GitHubIssue[]> {
  const res = await apiRequest<{ issues: GitHubIssue[] }>("/repo/issues", {
    method: "POST",
    body: JSON.stringify({ owner, repo, state, githubToken }),
  });

  return res.issues;
}

/**
 * GET /api/repo/pulls — Fetches pull requests.
 * Server returns { pulls: [...] }.
 */
export async function fetchPullRequests(
  owner: string,
  repo: string,
  state: "open" | "closed" | "all" = "open",
  githubToken?: string
): Promise<GitHubPullRequest[]> {
  const params = new URLSearchParams({ owner, repo, state });
  if (githubToken) params.set("githubToken", githubToken);

  const res = await apiRequest<{ pulls: GitHubPullRequest[] }>(
    `/repo/pulls?${params.toString()}`
  );

  return res.pulls;
}

/**
 * GET /api/repo/commits — Fetches recent commits.
 * Server returns { commits: [...] }.
 */
export async function fetchCommits(
  owner: string,
  repo: string,
  githubToken?: string
): Promise<GitHubCommit[]> {
  const params = new URLSearchParams({ owner, repo });
  if (githubToken) params.set("githubToken", githubToken);

  const res = await apiRequest<{ commits: GitHubCommit[] }>(
    `/repo/commits?${params.toString()}`
  );

  return res.commits;
}

/**
 * GET /api/repo/pulls/:pr/diff — Fetches PR diff text.
 * Server returns plain text.
 */
export async function fetchPullRequestDiff(
  owner: string,
  repo: string,
  prNumber: number,
  githubToken?: string
): Promise<string> {
  const params = new URLSearchParams({ owner, repo });
  if (githubToken) params.set("githubToken", githubToken);

  const url = `${BASE}/repo/pulls/${prNumber}/diff?${params.toString()}`;
  const res = await fetch(url, { credentials: "include" });

  if (!res.ok) {
    throw new Error(`Failed to fetch PR diff: HTTP ${res.status}`);
  }

  return res.text();
}

// ═══════════════════════════════════════════════════════════════════════════════
// File Content Fetching
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/repo/file — Fetches content of a single file.
 */
export async function fetchFileContent(params: {
  owner: string;
  repo: string;
  path: string;
  githubToken?: string;
}): Promise<RepoFileContent> {
  return apiRequest<RepoFileContent>("/repo/file", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * POST /api/repo/fetch-batch — Batch fetches content for multiple files.
 */
export async function fetchFileBatch(params: {
  owner: string;
  repo: string;
  paths: string[];
  githubToken?: string;
}): Promise<BatchFetchResult> {
  return apiRequest<BatchFetchResult>("/repo/fetch-batch", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Vector Search — Ingest & Hybrid Search
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/search/ingest — Ingests code chunks into Actian VectorAI + Prisma.
 */
export async function ingestCodeChunks(
  repoId: string,
  files: { path: string; content: string }[],
  repoMeta?: { name?: string; owner?: string; description?: string; language?: string; stars?: number; forks?: number }
): Promise<IngestResponse> {
  return apiRequest<IngestResponse>("/search/ingest", {
    method: "POST",
    body: JSON.stringify({ repoId, files, repoMeta }),
  });
}

/**
 * POST /api/search/hybrid — Performs hybrid RRF search.
 */
export async function hybridSearch(
  query: string,
  repoId: string,
  filter?: { category?: string; language?: string }
): Promise<SearchResult[]> {
  const res = await apiRequest<HybridSearchResponse>("/search/hybrid", {
    method: "POST",
    body: JSON.stringify({ query, repoId, filter }),
  });

  return res.results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Chat Sessions — CRUD via Express /api/sessions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/sessions — Creates a new chat session.
 */
export async function createSession(
  repoId: string,
  repoMeta: Record<string, unknown>,
  repoContext: string,
  userId?: string
): Promise<string> {
  const res = await apiRequest<{ id: string }>("/sessions", {
    method: "POST",
    body: JSON.stringify({ repoId, repoMeta, repoContext, userId }),
  });

  return res.id;
}

/**
 * GET /api/sessions/:id — Loads a chat session by ID.
 */
export async function loadSession(sessionId: string): Promise<ChatSessionData> {
  return apiRequest<ChatSessionData>(`/sessions/${sessionId}`);
}

/**
 * PUT /api/sessions/:id — Updates the messages in a chat session.
 */
export async function updateSession(
  sessionId: string,
  messages: Array<{ role: string; content: string; timestamp?: string }>
): Promise<void> {
  await apiRequest<{ success: boolean }>(`/sessions/${sessionId}`, {
    method: "PUT",
    body: JSON.stringify({ messages }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Visitor Analytics
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/visits/track — Records a visitor analytics event.
 */
export async function trackVisit(visitorId: string): Promise<void> {
  await apiRequest<{ success: boolean }>("/visits/track", {
    method: "POST",
    body: JSON.stringify({ visitor_id: visitorId }),
  });
}

/**
 * GET /api/visits/stats — Returns total unique visitor count.
 */
export async function fetchVisitStats(): Promise<VisitStats> {
  return apiRequest<VisitStats>("/visits/stats");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Health Check
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /health — Server health check (Postgres + Actian VectorAI status).
 * Note: This endpoint is NOT under /api, it's at the root level.
 */
export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch("/health");
  if (!res.ok) {
    throw new Error(`Health check failed: HTTP ${res.status}`);
  }
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Auth — GitHub OAuth (server-side session, cookie-based)
// ═══════════════════════════════════════════════════════════════════════════════

export interface AuthUser {
  id: string;
  email: string | null;
  created_at: string;
  user_metadata: {
    avatar_url: string | null;
    user_name: string;
    full_name: string | null;
  };
}

export interface AuthSession {
  provider_token: string;
}

/**
 * Full-page redirect to kick off the GitHub OAuth flow.
 * Not a fetch — GitHub's consent screen must be a top-level navigation.
 */
export function githubLoginUrl(): string {
  return `${BASE}/auth/github`;
}

/**
 * GET /api/auth/me — Returns the current session's user + GitHub provider token, or null if signed out.
 */
export async function fetchCurrentUser(): Promise<{ user: AuthUser; session: AuthSession } | null> {
  const res = await fetch(`${BASE}/auth/me`, { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Failed to fetch current user: HTTP ${res.status}`);
  return res.json();
}

/**
 * GET /api/auth/repos — Lists the signed-in user's GitHub repositories.
 */
export async function fetchUserRepositories(): Promise<any[]> {
  return apiRequest<any[]>("/auth/repos");
}

/**
 * POST /api/auth/logout — Destroys the server-side session and clears the cookie.
 */
export async function logoutUser(): Promise<void> {
  await apiRequest<{ success: boolean }>("/auth/logout", { method: "POST" });
}

export interface IndexedRepoEntry {
  id: string;
  repoId: string;
  owner: string;
  name: string;
  description: string | null;
  language: string | null;
  stars: number | null;
  forks: number | null;
  lastIndexedAt: string;
  createdAt: string;
}

/**
 * GET /api/auth/indexed-repos — Repos this user has analyzed on GitPlus (distinct
 * from /auth/repos, which lists their raw GitHub repos available to index).
 */
export async function fetchIndexedRepos(): Promise<IndexedRepoEntry[]> {
  const res = await apiRequest<{ repos: IndexedRepoEntry[] }>("/auth/indexed-repos");
  return res.repos;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VexReview — AI PR Reviewer (runs server-side, posts real GitHub review comments)
// ═══════════════════════════════════════════════════════════════════════════════

export interface VexReviewRun {
  id: string;
  configId: string;
  userId: string;
  prNumber: number;
  status: "queued" | "running" | "completed" | "failed";
  stage: string | null;
  stageMessage: string | null;
  resultStatus: "reviewed" | "skipped" | "rejected_sensitive_files" | null;
  filesReviewed: number | null;
  reviewComments: number | null;
  lgtmCount: number | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

export async function fetchVexReviewStatus(owner: string, repo: string): Promise<{ enabled: boolean; runs: VexReviewRun[] }> {
  const params = new URLSearchParams({ owner, repo });
  return apiRequest(`/vexreview/status?${params.toString()}`);
}

export async function enableVexReview(owner: string, repo: string): Promise<void> {
  await apiRequest("/vexreview/enable", { method: "POST", body: JSON.stringify({ owner, repo }) });
}

export async function disableVexReview(owner: string, repo: string): Promise<void> {
  await apiRequest("/vexreview/disable", { method: "POST", body: JSON.stringify({ owner, repo }) });
}

export async function triggerVexReview(
  owner: string,
  repo: string,
  prNumber: number
): Promise<{ runId: string; alreadyRunning: boolean }> {
  return apiRequest("/vexreview/review", {
    method: "POST",
    body: JSON.stringify({ owner, repo, prNumber }),
  });
}

export async function fetchVexReviewRun(runId: string): Promise<VexReviewRun> {
  const res = await apiRequest<{ run: VexReviewRun }>(`/vexreview/runs/${runId}`);
  return res.run;
}
