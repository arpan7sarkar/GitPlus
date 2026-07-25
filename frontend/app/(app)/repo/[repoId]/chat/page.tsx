"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Loader2, Sparkles, PanelLeftClose, PanelLeft,
  Trash2, Plus, History, Share2, Check, X,
} from "lucide-react";
import { PageTransition } from "@/components/shared/page-transition";
import { ChatMessage } from "@/components/app/chat-message";
import { FileViewer } from "@/components/app/file-viewer";
import { FileExplorer } from "@/components/app/file-explorer";
import { useRepoStore } from "@/lib/stores/repo-store";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { streamChat, fetchFileContent } from "@/lib/api";
import {
  createChatSession,
  updateSessionMessages,
  loadChatSession,
  type ChatMessageData,
} from "@/lib/chat-session";
import {
  getChatHistory,
  saveChatHistoryEntry,
  removeChatHistoryEntry,
  type ChatHistoryEntry,
} from "@/lib/chat-history";

// Extract [file:L1-L2] style citations from AI response text
function extractCitations(text: string): ChatMessageData["citations"] {
  const citations: NonNullable<ChatMessageData["citations"]> = [];
  const regex = /`?([a-zA-Z0-9_/.\-]+\.[a-zA-Z]+):(\d+)[-–](\d+)`?/g;
  let match: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((match = regex.exec(text)) !== null) {
    const key = `${match[1]}:${match[2]}-${match[3]}`;
    if (!seen.has(key)) {
      seen.add(key);
      citations.push({
        filePath: match[1],
        startLine: parseInt(match[2]),
        endLine: parseInt(match[3]),
        snippet: `Lines ${match[2]}-${match[3]}`,
      });
    }
    if (citations.length >= 5) break;
  }
  return citations;
}

export default function ChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const repoId = params?.repoId as string;
  const initialQ = searchParams?.get("q") ?? "";

  const { meta, repoContext, fileTree, githubToken, indexMode, unfetchedFiles } = useRepoStore();
  const { settings } = useSettingsStore();

  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [input, setInput] = useState(initialQ);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistoryEntry[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeFile, setActiveFile] = useState<{
    path: string;
    startLine?: number;
    endLine?: number;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sentInitialQ = useRef(false);

  // Load per-repo history on mount
  useEffect(() => {
    setChatHistory(getChatHistory().filter((h) => h.repoId === repoId));
  }, [repoId]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-send initial question from URL
  useEffect(() => {
    if (initialQ && messages.length === 0 && !sentInitialQ.current) {
      sentInitialQ.current = true;
      handleSend(initialQ);
      setInput("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lazily create / return existing session id
  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionId) return sessionId;
    if (!settings.autoSaveChatHistory || !meta) {
      return `local-${Date.now()}`;
    }
    try {
      const sid = await createChatSession(
        repoId,
        meta,
        repoContext || `Repository: ${meta.name} by ${meta.owner}`
      );
      setSessionId(sid);
      return sid;
    } catch {
      return `local-${Date.now()}`;
    }
  }, [sessionId, settings.autoSaveChatHistory, meta, repoId, repoContext]);

  const persistHistory = useCallback(
    (msgs: ChatMessageData[], sid: string) => {
      if (!settings.autoSaveChatHistory || !meta) return;
      const lastAsst = [...msgs].reverse().find((m) => m.role === "assistant");
      saveChatHistoryEntry({
        sessionId: sid,
        repoId,
        repoName: meta.name,
        repoOwner: meta.owner,
        lastMessage: lastAsst?.content?.slice(0, 120) || "New chat",
        messageCount: msgs.length,
        updatedAt: new Date().toISOString(),
      });
      setChatHistory(getChatHistory().filter((h) => h.repoId === repoId));
    },
    [settings.autoSaveChatHistory, meta, repoId]
  );

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isStreaming) return;

    const userMsg: ChatMessageData = {
      id: `u-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    const assistantId = `a-${Date.now() + 1}`;
    const assistantMsg: ChatMessageData = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setIsStreaming(true);

    // Build chat history for the API
    const chatHist = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Enrich context with on-demand file listing
    let contextForAI = repoContext || `Repository: ${meta?.name} by ${meta?.owner}`;
    if (indexMode === "on-demand" && unfetchedFiles.length > 0) {
      const fileList = unfetchedFiles.slice(0, 500).map((f) => f.path).join("\n");
      contextForAI += `\n\n--- ADDITIONAL FILES AVAILABLE ON-DEMAND (contents not yet loaded) ---\n${fileList}\n--- END FILE LISTING ---`;
    }

    let fullContent = "";

    await streamChat({
      messages: chatHist,
      repoContext: contextForAI,
      onDelta: (chunk) => {
        fullContent += chunk;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: fullContent } : m
          )
        );
      },
      onDone: async () => {
        const citations = extractCitations(fullContent);
        setMessages((prev) => {
          const updated = prev.map((m) =>
            m.id === assistantId ? { ...m, content: fullContent, citations } : m
          );
          // Persist to server + local history
          if (settings.autoSaveChatHistory) {
            ensureSession().then((sid) => {
              if (!sid.startsWith("local-")) {
                updateSessionMessages(sid, updated);
              }
              persistHistory(updated, sid);
            });
          }
          return updated;
        });
        setIsStreaming(false);
      },
      onError: (err) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `❌ Error: ${err}` }
              : m
          )
        );
        setIsStreaming(false);
      },
    });
  };

  const handleShare = useCallback(async () => {
    try {
      const sid = await ensureSession();
      if (!sid.startsWith("local-")) {
        await updateSessionMessages(sid, messages);
      }
      const url = `${window.location.origin}/shared/${sid}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* ignore */
    }
  }, [ensureSession, messages]);

  const loadSession = async (entry: ChatHistoryEntry) => {
    try {
      const session = await loadChatSession(entry.sessionId);
      if (session) {
        setSessionId(session.id);
        setMessages(session.messages);
        setShowHistory(false);
      } else {
        removeChatHistoryEntry(entry.sessionId);
        setChatHistory(getChatHistory().filter((h) => h.repoId === repoId));
      }
    } catch {
      /* ignore */
    }
  };

  const startNewChat = () => {
    setSessionId(null);
    setMessages([]);
    setActiveFile(null);
    setShowHistory(false);
  };

  const deleteEntry = (e: React.MouseEvent, sid: string) => {
    e.stopPropagation();
    removeChatHistoryEntry(sid);
    setChatHistory(getChatHistory().filter((h) => h.repoId === repoId));
  };

  const handleCitationClick = async (citation: {
    filePath: string;
    startLine: number;
    endLine: number;
  }) => {
    setActiveFile({
      path: citation.filePath,
      startLine: citation.startLine,
      endLine: citation.endLine,
    });
    // Fetch file content on-demand if not cached
    const { fileContents, upsertFileContent } = useRepoStore.getState();
    if (!fileContents[citation.filePath]) {
      try {
        const content = await fetchFileContent(repoId, citation.filePath, githubToken || undefined);
        upsertFileContent(citation.filePath, content);
      } catch {
        /* non-fatal */
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <PageTransition className="h-[calc(100vh-120px)] flex">
      {/* File explorer sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-r border-[#E5E5E3] bg-white overflow-hidden shrink-0"
          >
            <div className="p-3 border-b border-[#E5E5E3]">
              <p className="text-xs font-semibold text-[#111114] uppercase tracking-wider">Files</p>
            </div>
            <div className="h-full overflow-y-auto">
              <FileExplorer
                files={fileTree}
                onFileSelect={(path) =>
                  handleCitationClick({ filePath: path, startLine: 1, endLine: 9999 })
                }
                activeFile={activeFile?.path}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#E5E5E3] bg-white shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 rounded-lg text-[#5B5F66] hover:bg-[#F5F5F4] transition-colors"
            >
              {showSidebar ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#4338CA]" />
              <span className="text-sm font-medium text-[#111114]">
                {meta?.owner}/{meta?.name}
              </span>
              {indexMode === "on-demand" && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-200">
                  ON-DEMAND
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* History toggle */}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-lg transition-colors ${showHistory ? "bg-[#EEF2FF] text-[#4338CA]" : "text-[#5B5F66] hover:bg-[#F5F5F4]"}`}
              title="Chat history"
            >
              <History className="h-4 w-4" />
            </button>
            {/* Share */}
            {messages.length > 0 && (
              <button
                onClick={handleShare}
                className="p-2 rounded-lg text-[#5B5F66] hover:bg-[#F5F5F4] hover:text-[#4338CA] transition-colors"
                title="Share chat"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
              </button>
            )}
            {/* New chat */}
            <button
              onClick={startNewChat}
              className="p-2 rounded-lg text-[#5B5F66] hover:bg-[#F5F5F4] hover:text-[#111114] transition-colors"
              title="New chat"
            >
              <Plus className="h-4 w-4" />
            </button>
            {/* Clear */}
            <button
              onClick={startNewChat}
              className="p-2 rounded-lg text-[#5B5F66] hover:bg-red-50 hover:text-red-600 transition-colors"
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* History drawer */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="border-b border-[#E5E5E3] bg-white overflow-hidden shrink-0"
            >
              <div className="p-3 max-h-44 overflow-y-auto">
                <p className="text-[10px] text-[#5B5F66] uppercase tracking-wider font-semibold mb-2">
                  Previous Sessions
                </p>
                {chatHistory.length === 0 ? (
                  <p className="text-xs text-[#5B5F66] italic">No history yet.</p>
                ) : (
                  <div className="space-y-1">
                    {chatHistory.map((entry) => (
                      <button
                        key={entry.sessionId}
                        onClick={() => loadSession(entry)}
                        className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#F5F5F4] transition-colors group ${
                          entry.sessionId === sessionId ? "bg-[#EEF2FF]" : ""
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[#111114] truncate">{entry.lastMessage || "Empty chat"}</p>
                          <p className="text-[10px] text-[#5B5F66]">
                            {entry.messageCount} msgs · {new Date(entry.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={(e) => deleteEntry(e, entry.sessionId)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-[#C5C5C3] hover:text-red-500 transition-all"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-[#FAFAFA]">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#4338CA] to-[#6366F1] flex items-center justify-center mb-6 shadow-md">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <h2 className="text-xl font-bold text-[#111114] mb-2">Ask anything about this codebase</h2>
              <p className="text-sm text-[#5B5F66] max-w-sm">
                Get AI-powered answers with file citations and code snippets.
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              role={msg.role}
              content={msg.content}
              citations={msg.citations}
              isStreaming={
                isStreaming &&
                msg.id === messages[messages.length - 1]?.id &&
                msg.role === "assistant"
              }
              onCitationClick={handleCitationClick}
            />
          ))}
        </div>

        {/* Input */}
        <div className="border-t border-[#E5E5E3] bg-white px-6 py-4 shrink-0">
          <div className="max-w-3xl mx-auto flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about the codebase..."
                rows={1}
                className="w-full resize-none rounded-xl border border-[#E5E5E3] bg-[#FAFAFA] px-4 py-3 text-sm text-[#111114] placeholder:text-[#C5C5C3] focus:outline-none focus:border-[#4338CA] focus:ring-2 focus:ring-[#4338CA]/10 transition-all"
                style={{ minHeight: 44, maxHeight: 120 }}
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleSend()}
              disabled={!input.trim() || isStreaming}
              className="p-3 rounded-xl bg-gradient-to-r from-[#4338CA] to-[#6366F1] text-white shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* File viewer panel */}
      <AnimatePresence>
        {activeFile && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "40%" }}
            exit={{ width: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="shrink-0 overflow-hidden"
          >
            <FileViewer
              filePath={activeFile.path}
              startLine={activeFile.startLine}
              endLine={activeFile.endLine}
              onClose={() => setActiveFile(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
