// ─────────────────────────────────────────────────────────────────────────────
// lib/chat-session.ts — Chat Session persistence via /api/sessions
// Replaces: faah's supabase-based chat-session.ts
// ─────────────────────────────────────────────────────────────────────────────

import type { RepoMeta } from "./api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api";

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  citations?: Array<{
    filePath: string;
    startLine: number;
    endLine: number;
    snippet?: string;
  }>;
}

export interface ChatSession {
  id: string;
  repoId: string;
  repo_meta: RepoMeta;
  messages: ChatMessageData[];
  repoContext: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

// POST /api/sessions — create a new session, returns the session id
export async function createChatSession(
  repoId: string,
  repoMeta: RepoMeta,
  repoContext: string,
  userId?: string
): Promise<string> {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoId, repoMeta, repoContext, userId }),
  });
  if (!res.ok) throw new Error(`Failed to create session: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.id;
}

// GET /api/sessions/:id — load session by id
export async function loadChatSession(
  sessionId: string
): Promise<ChatSession | null> {
  try {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to load session: ${res.status}`);
    const data = await res.json();
    if (data.error) return null;
    return {
      id: data.id,
      repoId: data.repoId,
      repo_meta: data.repoMeta,
      messages: Array.isArray(data.messages) ? data.messages : [],
      repoContext: data.repoContext || "",
      isPublic: data.isPublic ?? true,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  } catch {
    return null;
  }
}

// PUT /api/sessions/:id — persist updated messages
export async function updateSessionMessages(
  sessionId: string,
  messages: ChatMessageData[]
): Promise<void> {
  try {
    const serialized = messages.map((m) => ({
      ...m,
      timestamp:
        typeof m.timestamp === "string"
          ? m.timestamp
          : new Date().toISOString(),
    }));
    await fetch(`${API_BASE}/sessions/${sessionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: serialized }),
    });
  } catch {
    // Non-fatal — session save failures should not block the user
  }
}
