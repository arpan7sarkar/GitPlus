"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle, Code2, Eye, ArrowRight } from "lucide-react";
import { loadChatSession, type ChatSession } from "@/lib/chat-session";
import { ChatMessage } from "@/components/app/chat-message";
import { FileViewer } from "@/components/app/file-viewer";

export default function SharedChatPage() {
  const params = useParams();
  const sessionId = params?.sessionId as string;

  const [session, setSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<{
    path: string;
    startLine?: number;
    endLine?: number;
  } | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    loadChatSession(sessionId)
      .then((s) => {
        if (!s) setError("Session not found or is no longer available.");
        else setSession(s);
      })
      .catch(() => setError("Failed to load this shared session."))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#4338CA]" />
          <p className="text-sm text-[#5B5F66]">Loading shared chat…</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-sm w-full card p-8 text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>
          <h1 className="text-lg font-bold text-[#111114] mb-2">Session Not Found</h1>
          <p className="text-sm text-[#5B5F66] mb-6">
            {error ?? "This shared session doesn't exist or has been removed."}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#4338CA] to-[#6366F1] text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all"
          >
            <ArrowRight className="h-4 w-4" />
            Try CodebaseGPT
          </Link>
        </motion.div>
      </div>
    );
  }

  const meta = session.repo_meta;

  return (
    <div className="h-screen flex flex-col bg-[#FAFAFA]">
      {/* Header nav */}
      <header className="sticky top-0 z-50 border-b border-[#E5E5E3] bg-white/90 backdrop-blur-md shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-14 px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#4338CA] to-[#6366F1] flex items-center justify-center">
                <Code2 className="h-3.5 w-3.5 text-white" />
              </div>
            </Link>
            <span className="text-[#C5C5C3]">/</span>
            <span className="text-sm text-[#5B5F66]">{meta?.owner}</span>
            <span className="text-[#C5C5C3]">/</span>
            <span className="text-sm font-semibold text-[#111114]">{meta?.name}</span>
            <span className="text-[#C5C5C3]">·</span>
            <span className="text-xs text-[#5B5F66]">Shared Chat</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-[#F5F5F4] border border-[#E5E5E3] text-[#5B5F66]">
              <Eye className="h-3 w-3" />
              Read-only
            </span>
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#111114] text-white text-xs font-semibold hover:bg-[#1E1E22] transition-colors"
            >
              Try CodebaseGPT
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex min-h-0">
        {/* Messages */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {session.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-20">
                <p className="text-sm text-[#5B5F66] italic">
                  This shared session has no messages yet.
                </p>
              </div>
            ) : (
              session.messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  citations={msg.citations}
                  onCitationClick={(c) =>
                    setActiveFile({ path: c.filePath, startLine: c.startLine, endLine: c.endLine })
                  }
                />
              ))
            )}
          </div>

          {/* CTA footer */}
          <div className="shrink-0 border-t border-[#E5E5E3] bg-white px-6 py-4">
            <div className="max-w-3xl mx-auto flex items-center justify-between">
              <p className="text-sm text-[#5B5F66]">
                Want to explore this codebase yourself?
              </p>
              <Link
                href="/"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#4338CA] to-[#6366F1] text-white text-xs font-semibold shadow-sm hover:shadow-md transition-all"
              >
                Start a new chat
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
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
      </div>
    </div>
  );
}
