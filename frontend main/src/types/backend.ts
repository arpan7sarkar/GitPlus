export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory" | "folder";
  size?: number;
  children?: FileTreeNode[];
  language?: string;
}

export interface RepoMeta {
  id?: string;
  owner: string;
  name: string;
  description?: string;
  stars?: number;
  forks?: number;
  language?: string;
  fileCount?: number;
  framework?: string;
  complexity?: "Low" | "Medium" | "High" | "Enterprise" | string;
}

export interface IndexedRepo {
  repoId: string;
  meta: RepoMeta;
  fileTree: FileTreeNode[];
  fileContents: { path: string; content: string; size: number }[];
  repoContext: string;
  totalFiles: number;
  indexMode: "full" | "on-demand";
  totalSourceFiles: number;
  skeletonFilesFetched: number;
  unfetchedFiles: { path: string; size: number }[];
}

export interface BatchFetchResult {
  files: { path: string; content: string; size: number; error?: string }[];
  fetched: number;
  errors: number;
}

export interface OverviewData {
  narrative: string;
  framework: string;
  complexity: string;
  suggestedQs: string[];
  keyFiles: string[];
  keyPatterns: string[];
  mainDeps: string[];
  languages: string[] | { name: string; percentage: number }[];
}

export interface SecurityFinding {
  id: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  file: string;
  line: string | null;
  recommendation: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  labels: { name: string; color: string }[];
  user: { login: string; avatar_url: string };
  comments: number;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  body: string;
  state: string;
  user: { login: string; avatar_url: string };
  created_at: string;
  updated_at: string;
  html_url: string;
  draft: boolean;
  merged_at: string | null;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
  author: { login: string; avatar_url: string } | null;
  html_url: string;
}

export interface RepoFileContent {
  path: string;
  content: string;
  size: number;
  truncated?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

// ─── New interfaces for server integration ──────────────────────────────────

export interface SearchResult {
  id: string;
  filePath: string;
  codeSnippet: string;
  startLine: number;
  endLine: number;
  score: number;
  category: string;
  language: string;
  symbolType: string;
}

export interface HybridSearchResponse {
  results: SearchResult[];
}

export interface IngestResponse {
  success: boolean;
  count: number;
}

export interface HealthResponse {
  status: "ok" | "degraded" | "error";
  service: string;
  postgres: "connected" | "disconnected";
  vectorai: "connected" | "disconnected";
  vectorPointCount: number;
  timestamp: string;
}

export interface ChatSessionData {
  id: string;
  repoId: string;
  repo_id: string;
  userId: string | null;
  repoMeta: Record<string, unknown>;
  repo_meta: Record<string, unknown>;
  messages: ChatMessage[];
  repoContext: string;
  repo_context: string;
  isPublic: boolean;
  is_public: boolean;
  createdAt: string;
  created_at: string;
  updatedAt: string;
  updated_at: string;
}

export interface VisitStats {
  count: number;
}
