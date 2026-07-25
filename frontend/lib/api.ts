// ─────────────────────────────────────────────────────────────────────────────
// lib/api.ts — API Contract for GitPlus / CodebaseGPT
// ─────────────────────────────────────────────────────────────────────────────

import {
  MOCK_REPO_META,
  MOCK_FILE_TREE,
  MOCK_FILE_CONTENTS,
  MOCK_REPO_CONTEXT,
} from "./mock-data/index";
import { MOCK_OVERVIEW } from "./mock-data/overview";
import { MOCK_SECURITY_FINDINGS } from "./mock-data/security";
import { MOCK_ISSUES } from "./mock-data/issues";
import { MOCK_PRS, MOCK_DIFF } from "./mock-data/prs";
import { MOCK_COMMITS } from "./mock-data/commits";
import { MOCK_CHAT_RESPONSE } from "./mock-data/chat";
import { MOCK_ONBOARDING_DOC } from "./mock-data/onboarding";
import { MOCK_SYSTEM_DESIGN } from "./mock-data/system-design";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`
    : "http://localhost:3000/api");

function isLive(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK !== "true";
}

function mockDelay(ms = 800): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RepoMeta {
  id: string;
  owner: string;
  name: string;
  description: string;
  language: string;
  stars: number;
  fileCount: number;
  framework?: string;
  complexity?: string;
}

export interface FileNode {
  path: string;
  type: "file" | "dir" | "folder";
  size?: number;
  children?: FileNode[];
  language?: string;
}

export interface RepoOverview {
  narrative: string;
  framework: string;
  complexity: "Low" | "Medium" | "High" | "Enterprise";
  keyFiles: string[];
  mainDeps: string[];
  suggestedQs: string[];
}

export interface SecurityFinding {
  id: string; // e.g. SEC-001
  title: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  description: string;
  file?: string;
  line?: number;
  recommendation: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  html_url: string;
  labels: { name: string; color: string }[];
  comments: number;
  updated_at: string;
  created_at: string;
  user: { login: string; avatar_url: string };
  pull_request?: object;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  draft: boolean;
  merged_at: string | null;
  html_url: string;
  updated_at: string;
  created_at: string;
  user: { login: string; avatar_url: string };
}

export interface GitHubCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string; email?: string; date: string };
  };
  author: { login: string; avatar_url: string } | null;
}

export interface IndexResult {
  repoId: string;
  meta: RepoMeta;
  fileTree: FileNode[];
  fileContents: Record<string, string>;
  repoContext: string;
  totalFiles: number;
  indexMode: "full" | "on-demand";
  totalSourceFiles?: number;
  unfetchedFiles?: FileNode[];
}

// ─── indexRepository ─────────────────────────────────────────────────────────

export async function indexRepository(
  githubUrl: string,
  githubToken?: string,
  onProgress?: (stage: number, message: string) => void
): Promise<IndexResult> {
  if (isLive()) {
    try {
      onProgress?.(1, "Validating Repository URL...");
      onProgress?.(2, "Fetching Git Tree & Directory Structure...");

      const res = await fetch(`${API_BASE}/repo/index`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubUrl, githubToken }),
      });

      if (!res.ok) {
        const errText = await res.text();
        let msg = `HTTP ${res.status}`;
        try {
          const parsed = JSON.parse(errText);
          msg = parsed.error || msg;
        } catch {}
        throw new Error(msg);
      }

      onProgress?.(3, "Extracting Skeleton Files & Context...");
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      onProgress?.(4, "Building Codebase Intelligence Model...");

      const fileContents: Record<string, string> = {};
      if (Array.isArray(data.fileContents)) {
        for (const item of data.fileContents) {
          if (item && item.path) {
            fileContents[item.path] = item.content || "";
          }
        }
      } else if (data.fileContents && typeof data.fileContents === "object") {
        Object.assign(fileContents, data.fileContents);
      }

      const unfetchedFiles: FileNode[] = Array.isArray(data.unfetchedFiles)
        ? data.unfetchedFiles.map((f: any) => ({
            path: typeof f === "string" ? f : f.path,
            type: "file",
            size: typeof f === "object" ? f.size || 0 : 0,
          }))
        : [];

      return {
        repoId: data.repoId || `gh-repo-${Date.now()}`,
        meta: data.meta,
        fileTree: data.fileTree || [],
        fileContents,
        repoContext: data.repoContext || "",
        totalFiles: data.totalFiles || data.totalSourceFiles || 0,
        indexMode: data.indexMode || "full",
        totalSourceFiles: data.totalSourceFiles || data.totalFiles || 0,
        unfetchedFiles,
      };
    } catch (err: any) {
      console.warn("[indexRepository] Live index failed:", err);
      if (process.env.NEXT_PUBLIC_USE_MOCK !== "true" && !githubUrl.includes("vercel/next.js")) {
        throw err;
      }
    }
  }

  // Mock Fallback
  const stages = [
    "Validating Repository URL...",
    "Fetching Git Tree & Directory Structure...",
    "Extracting Skeleton Files & Context...",
    "Building Codebase Intelligence Model...",
  ];
  for (let i = 0; i < stages.length; i++) {
    onProgress?.(i + 1, stages[i]);
    await mockDelay(400);
  }

  return {
    repoId: "gh-vercel-next-js-1720000000",
    meta: MOCK_REPO_META,
    fileTree: MOCK_FILE_TREE,
    fileContents: MOCK_FILE_CONTENTS,
    repoContext: MOCK_REPO_CONTEXT,
    totalFiles: 847,
    indexMode: "full",
    totalSourceFiles: 847,
    unfetchedFiles: [],
  };
}

// ─── fetchFileContent ─────────────────────────────────────────────────────────

export async function fetchFileContent(
  repoId: string,
  path: string,
  githubToken?: string
): Promise<string> {
  if (isLive()) {
    try {
      let owner = "vercel";
      let repo = "next.js";
      if (repoId.startsWith("gh-")) {
        const parts = repoId.split("-");
        if (parts.length >= 3) {
          owner = parts[1];
          repo = parts[2];
        }
      } else if (repoId.includes("/")) {
        const parts = repoId.split("/");
        owner = parts[0];
        repo = parts[1];
      }

      const res = await fetch(`${API_BASE}/repo/file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, path, githubToken }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data.content || "";
    } catch (e) {
      console.warn(`[fetchFileContent] Failed for ${path}:`, e);
      if (process.env.NEXT_PUBLIC_USE_MOCK !== "true") throw e;
    }
  }
  await mockDelay(300);
  return MOCK_FILE_CONTENTS[path] || `// Mock content for ${path}\nexport default {};\n`;
}

// ─── fetchFilesBatch ──────────────────────────────────────────────────────────

export async function fetchFilesBatch(
  repoId: string,
  paths: string[],
  githubToken?: string
): Promise<Record<string, string>> {
  if (isLive()) {
    try {
      let owner = "vercel";
      let repo = "next.js";
      if (repoId.startsWith("gh-")) {
        const parts = repoId.split("-");
        if (parts.length >= 3) {
          owner = parts[1];
          repo = parts[2];
        }
      } else if (repoId.includes("/")) {
        const parts = repoId.split("/");
        owner = parts[0];
        repo = parts[1];
      }

      const res = await fetch(`${API_BASE}/repo/fetch-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, paths: paths.slice(0, 10), githubToken }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const result: Record<string, string> = {};
      if (Array.isArray(data.files)) {
        for (const file of data.files) {
          if (file && file.path) {
            result[file.path] = file.content || "";
          }
        }
      }
      return result;
    } catch (e) {
      console.warn("[fetchFilesBatch] Failed:", e);
      if (process.env.NEXT_PUBLIC_USE_MOCK !== "true") throw e;
    }
  }
  await mockDelay(400);
  return Object.fromEntries(
    paths.slice(0, 10).map((p) => [
      p,
      MOCK_FILE_CONTENTS[p] || `// Mock content for ${p}\nexport default {};\n`,
    ])
  );
}

// ─── streamChat ───────────────────────────────────────────────────────────────

interface StreamChatOptions {
  messages: { role: string; content: string }[];
  repoContext?: string | null;
  action?: "overview" | "onboarding" | "security" | "system-design" | "default";
  onDelta: (chunk: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

export async function streamChat(opts: StreamChatOptions): Promise<void> {
  const { messages, repoContext, action = "default", onDelta, onDone, onError } = opts;

  if (isLive()) {
    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, repoContext, action }),
      });

      if (!res.ok) {
        const errText = await res.text();
        let errorMsg = `HTTP ${res.status}`;
        try {
          const parsed = JSON.parse(errText);
          errorMsg = parsed.error || errorMsg;
        } catch {}
        onError(errorMsg);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        onError("No response body");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith("data: ")) {
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === "[DONE]") {
              onDone();
              return;
            }
            try {
              const parsed = JSON.parse(dataStr);
              const delta =
                parsed.choices?.[0]?.delta?.content ||
                parsed.content ||
                parsed.text ||
                parsed.delta ||
                "";
              if (delta) onDelta(delta);
            } catch {
              if (dataStr) onDelta(dataStr);
            }
          } else if (!trimmed.startsWith(":")) {
            onDelta(line + "\n");
          }
        }
      }

      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith("data: ")) {
          const dataStr = trimmed.slice(6).trim();
          if (dataStr !== "[DONE]") {
            try {
              const parsed = JSON.parse(dataStr);
              const delta =
                parsed.choices?.[0]?.delta?.content ||
                parsed.content ||
                parsed.text ||
                "";
              if (delta) onDelta(delta);
            } catch {
              if (dataStr) onDelta(dataStr);
            }
          }
        } else {
          onDelta(buffer);
        }
      }

      onDone();
      return;
    } catch (e) {
      console.warn("[streamChat] Exception:", e);
      if (process.env.NEXT_PUBLIC_USE_MOCK !== "true") {
        onError(e instanceof Error ? e.message : "Stream failed");
        return;
      }
    }
  }

  // Mock SSE stream
  try {
    const response = MOCK_CHAT_RESPONSE;
    const words = response.split(" ");
    for (const word of words) {
      await new Promise((r) => setTimeout(r, 30 + Math.random() * 20));
      onDelta(word + " ");
    }
    onDone();
  } catch (e) {
    onError(e instanceof Error ? e.message : "Mock stream failed");
  }
}

// ─── generateOverview ─────────────────────────────────────────────────────────

export async function generateOverview(repoContext: string): Promise<RepoOverview> {
  if (isLive()) {
    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [], repoContext, action: "overview" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      let rawContent = data.content || "";
      rawContent = rawContent.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
      const parsed = JSON.parse(rawContent);
      return {
        narrative: parsed.narrative || "Overview unavailable",
        framework: parsed.framework || "Unknown",
        complexity: parsed.complexity || "Medium",
        keyFiles: parsed.keyFiles || [],
        mainDeps: parsed.mainDeps || [],
        suggestedQs: parsed.suggestedQs || [],
      };
    } catch (e) {
      console.warn("[generateOverview] Failed, using fallback:", e);
    }
  }
  await mockDelay(800);
  return MOCK_OVERVIEW;
}

// ─── generateSecurityScan ─────────────────────────────────────────────────────

export async function generateSecurityScan(repoContext: string): Promise<SecurityFinding[]> {
  if (isLive()) {
    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [], repoContext, action: "security" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      let rawContent = data.content || "";
      rawContent = rawContent.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
      const parsed = JSON.parse(rawContent);
      if (Array.isArray(parsed)) {
        return parsed as SecurityFinding[];
      }
    } catch (e) {
      console.warn("[generateSecurityScan] Failed, using fallback:", e);
    }
  }
  await mockDelay(1200);
  return MOCK_SECURITY_FINDINGS;
}

// ─── generateSystemDesign ─────────────────────────────────────────────────────

export async function generateSystemDesign(repoContext: string): Promise<string> {
  if (isLive()) {
    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [], repoContext, action: "system-design" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data.content) return data.content;
    } catch (e) {
      console.warn("[generateSystemDesign] Failed, using fallback:", e);
    }
  }
  await mockDelay(1000);
  return MOCK_SYSTEM_DESIGN;
}

// ─── generateOnboardingDoc ────────────────────────────────────────────────────

export async function generateOnboardingDoc(repoContext: string): Promise<string> {
  if (isLive()) {
    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [], repoContext, action: "onboarding" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data.content) return data.content;
    } catch (e) {
      console.warn("[generateOnboardingDoc] Failed, using fallback:", e);
    }
  }
  await mockDelay(900);
  return MOCK_ONBOARDING_DOC;
}

// ─── fetchIssues ─────────────────────────────────────────────────────────────

export async function fetchIssues(
  owner: string,
  repo: string,
  state: "open" | "closed" = "open",
  token?: string
): Promise<GitHubIssue[]> {
  if (isLive()) {
    try {
      const res = await fetch(`${API_BASE}/repo/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, state, githubToken: token }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return data.issues || [];
    } catch (e) {
      console.warn("[fetchIssues] Failed, using fallback:", e);
    }
  }
  await mockDelay(400);
  return MOCK_ISSUES.filter((i) => i.state === state);
}

// ─── fetchPullRequests ────────────────────────────────────────────────────────

export async function fetchPullRequests(
  owner: string,
  repo: string,
  state: "open" | "closed" | "all" = "open",
  token?: string
): Promise<GitHubPullRequest[]> {
  if (isLive()) {
    try {
      const params = new URLSearchParams({ owner, repo, state });
      if (token) params.set("githubToken", token);
      const res = await fetch(`${API_BASE}/repo/pulls?${params}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return data.pulls || [];
    } catch (e) {
      console.warn("[fetchPullRequests] Failed, using fallback:", e);
    }
  }
  await mockDelay(400);
  return MOCK_PRS.filter((p) =>
    state === "all" ? true : state === "open" ? p.state === "open" : p.state === "closed"
  );
}

// ─── fetchPullRequestDiff ─────────────────────────────────────────────────────

export async function fetchPullRequestDiff(
  owner: string,
  repo: string,
  prNumber: number,
  token?: string
): Promise<string> {
  if (isLive()) {
    try {
      const params = new URLSearchParams({ owner, repo });
      if (token) params.set("githubToken", token);
      const res = await fetch(`${API_BASE}/repo/pulls/${prNumber}/diff?${params}`);
      if (!res.ok) throw new Error(await res.text());
      return res.text();
    } catch (e) {
      console.warn("[fetchPullRequestDiff] Failed, using fallback:", e);
    }
  }
  await mockDelay(300);
  return MOCK_DIFF;
}

// ─── fetchCommits ─────────────────────────────────────────────────────────────

export async function fetchCommits(
  owner: string,
  repo: string,
  token?: string
): Promise<GitHubCommit[]> {
  if (isLive()) {
    try {
      const params = new URLSearchParams({ owner, repo });
      if (token) params.set("githubToken", token);
      const res = await fetch(`${API_BASE}/repo/commits?${params}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return data.commits || [];
    } catch (e) {
      console.warn("[fetchCommits] Failed, using fallback:", e);
    }
  }
  await mockDelay(400);
  return MOCK_COMMITS;
}

// ─── trackVisit / fetchStats ──────────────────────────────────────────────────

export async function trackVisit(): Promise<void> {
  if (!isLive()) return;
  try {
    let visitorId = typeof window !== "undefined" ? localStorage.getItem("visitor_id") : null;
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      if (typeof window !== "undefined") {
        localStorage.setItem("visitor_id", visitorId);
      }
    }
    await fetch(`${API_BASE}/visits/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitor_id: visitorId }),
    });
  } catch {
    /* ignore */
  }
}

export async function fetchStats(): Promise<{ count: number }> {
  if (isLive()) {
    try {
      const res = await fetch(`${API_BASE}/visits/stats`);
      if (res.ok) return res.json();
    } catch {
      /* ignore */
    }
  }
  return { count: 4200 };
}

// ─── login ───────────────────────────────────────────────────────────────────

export async function login(): Promise<{ success: boolean }> {
  await mockDelay(200);
  return { success: true };
}

