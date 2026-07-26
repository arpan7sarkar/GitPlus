/**
 * Chat Session helpers — backed by Express /api/sessions endpoints.
 * Replaces the old Supabase direct-client implementation.
 */

import { createSession, loadSession, updateSession } from "@/lib/api";
import type { RepoMeta, ChatMessage } from "@/lib/mock-data";

export interface ChatSession {
  id: string;
  repo_id: string;
  repo_meta: RepoMeta;
  messages: ChatMessage[];
  repo_context: string;
  is_public: boolean;
  created_at: string;
}

export async function createChatSession(
  repoId: string,
  repoMeta: RepoMeta,
  repoContext: string
): Promise<string> {
  return createSession(repoId, repoMeta as unknown as Record<string, unknown>, repoContext);
}

export async function updateSessionMessages(
  sessionId: string,
  messages: ChatMessage[]
): Promise<void> {
  const serialized = messages.map((m) => ({
    ...m,
    timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
  }));

  await updateSession(sessionId, serialized);
}

export async function loadChatSession(sessionId: string): Promise<ChatSession | null> {
  try {
    const data = await loadSession(sessionId);

    return {
      id: data.id,
      repo_id: data.repoId || data.repo_id,
      repo_meta: data.repoMeta as unknown as RepoMeta,
      messages: ((data.messages || []) as unknown as any[]).map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      })),
      repo_context: data.repoContext || data.repo_context || "",
      is_public: data.isPublic ?? data.is_public ?? true,
      created_at: data.createdAt || data.created_at || "",
    };
  } catch {
    return null;
  }
}
