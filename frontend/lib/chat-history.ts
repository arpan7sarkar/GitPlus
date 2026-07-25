// ─────────────────────────────────────────────────────────────────────────────
// lib/chat-history.ts — Local chat history via localStorage (max 50 entries)
// Replaces: faah's lib/chat-history.ts
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "gitplus_chat_history";
const MAX_ENTRIES = 50;

export interface ChatHistoryEntry {
  sessionId: string;
  repoId: string;
  repoName: string;
  repoOwner: string;
  lastMessage: string;
  messageCount: number;
  updatedAt: string;
}

export function getChatHistory(): ChatHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChatHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveChatHistoryEntry(entry: ChatHistoryEntry): void {
  if (typeof window === "undefined") return;
  const history = getChatHistory();
  const idx = history.findIndex((h) => h.sessionId === entry.sessionId);
  if (idx >= 0) {
    history[idx] = entry;
  } else {
    history.unshift(entry);
  }
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(history.slice(0, MAX_ENTRIES))
    );
  } catch {
    /* localStorage full — ignore */
  }
}

export function removeChatHistoryEntry(sessionId: string): void {
  if (typeof window === "undefined") return;
  const history = getChatHistory().filter((h) => h.sessionId !== sessionId);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    /* ignore */
  }
}
