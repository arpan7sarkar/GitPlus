"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { CitationChip } from "./citation-chip";

interface Citation {
  filePath: string;
  startLine: number;
  endLine: number;
  snippet?: string;
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  isStreaming?: boolean;
  onCitationClick?: (citation: Citation) => void;
}

// ─── Markdown renderer ────────────────────────────────────────────────────────
// Handles: code blocks (with lang tag), inline code, **bold**, *italic*, 
//          headings (##), bullet lists, numbered lists, horizontal rules, line breaks.
// Keeps the existing design tokens from globals.css (prose-gitplus style).

function renderMarkdown(text: string, isStreaming?: boolean): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    // ── fenced code block ─────────────────────────────────────────────────
    const fenceMatch = lines[i].match(/^```(\w*)$/);
    if (fenceMatch) {
      const lang = fenceMatch[1] || "text";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // consume closing ```
      nodes.push(
        <div key={`code-${i}`} className="my-3 rounded-xl overflow-hidden border border-[#313244]">
          <div className="flex items-center gap-2 px-4 py-2 bg-[#1E1E2E] border-b border-[#313244]">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#F38BA8]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#FAB387]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#A6E3A1]" />
            </div>
            <span className="text-[10px] text-[#6C7086] font-mono ml-1">{lang}</span>
          </div>
          <pre className="bg-[#1E1E2E] px-4 py-3 overflow-x-auto">
            <code className="text-[#CDD6F4] text-xs font-mono leading-relaxed whitespace-pre">
              {codeLines.join("\n")}
            </code>
          </pre>
        </div>
      );
      continue;
    }

    const line = lines[i];

    // ── heading ##, ###  ─────────────────────────────────────────────────
    const h2 = line.match(/^## (.+)$/);
    if (h2) {
      nodes.push(
        <p key={`h2-${i}`} className="text-sm font-bold text-[#111114] mt-4 mb-1.5">
          {renderInline(h2[1])}
        </p>
      );
      i++;
      continue;
    }
    const h3 = line.match(/^### (.+)$/);
    if (h3) {
      nodes.push(
        <p key={`h3-${i}`} className="text-xs font-semibold text-[#5B5F66] uppercase tracking-wider mt-3 mb-1">
          {renderInline(h3[1])}
        </p>
      );
      i++;
      continue;
    }

    // ── horizontal rule ──────────────────────────────────────────────────
    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={`hr-${i}`} className="my-3 border-[#E5E5E3]" />);
      i++;
      continue;
    }

    // ── bullet list ──────────────────────────────────────────────────────
    if (/^[-*+] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+] /.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+] /, ""));
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="my-2 space-y-1 pl-4">
          {items.map((item, idx) => (
            <li key={idx} className="text-sm text-[#374151] leading-relaxed flex gap-2">
              <span className="text-[#4338CA] mt-1 shrink-0">•</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // ── numbered list ─────────────────────────────────────────────────────
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      let n = 1;
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      nodes.push(
        <ol key={`ol-${i}`} className="my-2 space-y-1 pl-4">
          {items.map((item, idx) => (
            <li key={idx} className="text-sm text-[#374151] leading-relaxed flex gap-2">
              <span className="text-[#4338CA] font-mono text-xs mt-1 shrink-0 w-4">{idx + n}.</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // ── empty line → spacing ─────────────────────────────────────────────
    if (line.trim() === "") {
      nodes.push(<div key={`sp-${i}`} className="h-2" />);
      i++;
      continue;
    }

    // ── paragraph ────────────────────────────────────────────────────────
    nodes.push(
      <p key={`p-${i}`} className="text-sm text-[#374151] leading-relaxed">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  // Streaming cursor at the end
  if (isStreaming) {
    nodes.push(
      <span
        key="cursor"
        className="inline-block w-2 h-4 bg-[#4338CA] rounded-sm ml-0.5 animate-pulse"
      />
    );
  }

  return nodes;
}

// ── Inline formatting: **bold**, *italic*, `code`, citations [file:L1-L2]
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-[#111114]">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i} className="italic">{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded text-xs font-mono bg-[#EEF2FF] text-[#4338CA]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ChatMessage = memo(function ChatMessage({
  role,
  content,
  citations,
  isStreaming,
  onCitationClick,
}: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4338CA] to-[#6366F1] flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="h-4 w-4 text-white" />
        </div>
      )}

      <div className={cn("min-w-0", isUser ? "max-w-[75%]" : "max-w-[85%]")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "bg-[#4338CA] text-white rounded-br-md"
              : "bg-white border border-[#E5E5E3] text-[#111114] rounded-bl-md shadow-sm"
          )}
        >
          {isUser ? (
            <span className="whitespace-pre-wrap">{content}</span>
          ) : (
            <div className="space-y-0.5">
              {renderMarkdown(content, isStreaming)}
            </div>
          )}
        </div>

        {/* Citation chips */}
        {citations && citations.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
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
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-lg bg-[#F5F5F4] border border-[#E5E5E3] flex items-center justify-center shrink-0 mt-0.5">
          <User className="h-4 w-4 text-[#5B5F66]" />
        </div>
      )}
    </motion.div>
  );
});
