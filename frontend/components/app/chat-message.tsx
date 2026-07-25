"use client";

import { motion } from "framer-motion";
import { User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { CitationChip } from "./citation-chip";
import { extractCitations } from "@/lib/utils";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  onCitationClick?: (citation: { filePath: string; startLine: number; endLine: number }) => void;
}

export function ChatMessage({ role, content, isStreaming, onCitationClick }: ChatMessageProps) {
  const citations = role === "assistant" ? extractCitations(content) : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn("flex gap-3", role === "user" ? "justify-end" : "justify-start")}
    >
      {role === "assistant" && (
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4338CA] to-[#6366F1] flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="h-4 w-4 text-white" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          role === "user"
            ? "bg-[#4338CA] text-white rounded-br-md"
            : "bg-white border border-[#E5E5E3] text-[#111114] rounded-bl-md shadow-sm"
        )}
      >
        {/* Render content with line breaks */}
        <div className="whitespace-pre-wrap">{content}</div>

        {/* Citation chips */}
        {citations.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-[#E5E5E3]/50">
            {citations.map((c, i) => (
              <CitationChip
                key={`${c.filePath}-${c.startLine}-${i}`}
                filePath={c.filePath}
                startLine={c.startLine}
                endLine={c.endLine}
                onClick={() => onCitationClick?.(c)}
              />
            ))}
          </div>
        )}

        {/* Streaming cursor */}
        {isStreaming && (
          <span className="inline-block w-2 h-4 bg-[#4338CA] rounded-sm ml-0.5 animate-pulse" />
        )}
      </div>

      {role === "user" && (
        <div className="w-8 h-8 rounded-lg bg-[#F5F5F4] border border-[#E5E5E3] flex items-center justify-center shrink-0 mt-0.5">
          <User className="h-4 w-4 text-[#5B5F66]" />
        </div>
      )}
    </motion.div>
  );
}
