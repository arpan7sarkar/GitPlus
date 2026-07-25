"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Sparkles, PanelLeftClose, PanelLeft, Trash2, Plus } from "lucide-react";
import { PageTransition } from "@/components/shared/page-transition";
import { ChatMessage } from "@/components/app/chat-message";
import { FileViewer } from "@/components/app/file-viewer";
import { FileExplorer } from "@/components/app/file-explorer";
import { useRepoStore } from "@/lib/stores/repo-store";
import { streamChat, fetchFileContent } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const repoId = params?.repoId as string;
  const initialQ = searchParams?.get("q") ?? "";

  const { meta, repoContext, fileTree } = useRepoStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialQ);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [activeFile, setActiveFile] = useState<{ path: string; startLine?: number; endLine?: number } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-send initial question
  useEffect(() => {
    if (initialQ && messages.length === 0) {
      handleSend(initialQ);
      setInput("");
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isStreaming) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content };
    const assistantMsg: Message = { id: `a-${Date.now()}`, role: "assistant", content: "" };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setIsStreaming(true);

    const chatMessages = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    await streamChat({
      messages: chatMessages,
      repoContext,
      onDelta: (chunk) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") {
            updated[updated.length - 1] = { ...last, content: last.content + chunk };
          }
          return updated;
        });
      },
      onDone: () => setIsStreaming(false),
      onError: (err) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") {
            updated[updated.length - 1] = { ...last, content: `Error: ${err}` };
          }
          return updated;
        });
        setIsStreaming(false);
      },
    });
  };

  const handleCitationClick = async (citation: { filePath: string; startLine: number; endLine: number }) => {
    setActiveFile({ path: citation.filePath, startLine: citation.startLine, endLine: citation.endLine });
    // Fetch file if needed
    const { fileContents, upsertFileContent } = useRepoStore.getState();
    if (!fileContents[citation.filePath]) {
      try {
        const content = await fetchFileContent(repoId, citation.filePath);
        upsertFileContent(citation.filePath, content);
      } catch { /* ignore */ }
    }
  };

  const handleClear = () => {
    setMessages([]);
    setActiveFile(null);
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
                onFileSelect={(path) => handleCitationClick({ filePath: path, startLine: 1, endLine: 10 })}
                activeFile={activeFile?.path}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#E5E5E3] bg-white">
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
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleClear}
              className="p-2 rounded-lg text-[#5B5F66] hover:bg-[#F5F5F4] hover:text-[#111114] transition-colors"
              title="New chat"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={handleClear}
              className="p-2 rounded-lg text-[#5B5F66] hover:bg-red-50 hover:text-red-600 transition-colors"
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

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
              isStreaming={isStreaming && msg.id === messages[messages.length - 1]?.id && msg.role === "assistant"}
              onCitationClick={handleCitationClick}
            />
          ))}
        </div>

        {/* Input */}
        <div className="border-t border-[#E5E5E3] bg-white px-6 py-4">
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

      {/* File viewer */}
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
