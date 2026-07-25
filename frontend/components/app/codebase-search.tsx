"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, FileCode, FolderOpen, TextSearch, ArrowRight, X, Command } from "lucide-react";
import { useRepoStore } from "@/lib/stores/repo-store";

interface FileTreeNode {
  path: string;
  name?: string;
  type: "file" | "dir" | "folder";
  children?: FileTreeNode[];
  language?: string;
}

function flattenTree(nodes: FileTreeNode[]): FileTreeNode[] {
  const result: FileTreeNode[] = [];
  const walk = (list: FileTreeNode[]) => {
    for (const n of list) {
      result.push(n);
      if (n.children) walk(n.children);
    }
  };
  walk(nodes);
  return result;
}

function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-[#4338CA] font-semibold">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

interface CodebaseSearchProps {
  repoId: string;
}

export function CodebaseSearch({ repoId }: CodebaseSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  const { fileTree, fileContents } = useRepoStore();

  const flatFiles = useMemo(() => flattenTree(fileTree as FileTreeNode[]), [fileTree]);

  // ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // File path search
  const fileResults = useMemo(() => {
    if (!query) return flatFiles.filter((n) => n.type === "file").slice(0, 8);
    const q = query.toLowerCase();
    return flatFiles
      .filter((n) => n.path.toLowerCase().includes(q) || (n.name || "").toLowerCase().includes(q))
      .slice(0, 10);
  }, [query, flatFiles]);

  // Content search
  const contentResults = useMemo(() => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    const matches: { path: string; line: string; lineNum: number }[] = [];
    const contents = fileContents as Record<string, string>;
    for (const [path, content] of Object.entries(contents)) {
      if (typeof content !== "string") continue;
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(q)) {
          matches.push({ path, line: lines[i].trim(), lineNum: i + 1 });
          if (matches.length >= 10) break;
        }
      }
      if (matches.length >= 10) break;
    }
    return matches;
  }, [query, fileContents]);

  const handleSelect = useCallback(
    (question: string) => {
      setOpen(false);
      router.push(`/repo/${repoId}/chat?q=${encodeURIComponent(question)}`);
    },
    [router, repoId]
  );

  return (
    <>
      {/* Trigger bar */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#E5E5E3] bg-[#F5F5F4] text-[#5B5F66] text-xs w-full max-w-xs hover:border-[#C7D2FE] hover:bg-[#EEF2FF] transition-all cursor-pointer group"
      >
        <Search className="h-3.5 w-3.5 shrink-0 group-hover:text-[#4338CA] transition-colors" />
        <span className="flex-1 text-left">Search codebase…</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-[#E5E5E3] bg-white px-1.5 py-0.5 text-[10px] font-mono text-[#5B5F66]">
          ⌘K
        </kbd>
      </button>

      {/* Overlay */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -20 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="fixed z-50 top-[15%] left-1/2 -translate-x-1/2 w-full max-w-lg"
            >
              <div className="bg-white rounded-2xl shadow-lg border border-[#E5E5E3] overflow-hidden">
                {/* Input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E5E5E3]">
                  <Search className="h-4 w-4 text-[#5B5F66] shrink-0" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search files, code, patterns…"
                    className="flex-1 text-sm text-[#111114] placeholder:text-[#C5C5C3] bg-transparent focus:outline-none"
                  />
                  <button
                    onClick={() => setOpen(false)}
                    className="p-1 rounded text-[#5B5F66] hover:bg-[#F5F5F4]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Results */}
                <div className="max-h-80 overflow-y-auto">
                  {/* Files */}
                  {fileResults.length > 0 && (
                    <div className="p-2">
                      <p className="text-[10px] text-[#5B5F66] uppercase tracking-wider font-semibold px-2 py-1">
                        Files
                      </p>
                      {fileResults.map((node) => (
                        <button
                          key={node.path}
                          onClick={() => handleSelect(`Explain the file: ${node.path}`)}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#F5F5F4] transition-colors text-left group"
                        >
                          {node.type === "folder" || node.type === "dir" ? (
                            <FolderOpen className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          ) : (
                            <FileCode className="h-3.5 w-3.5 text-[#4338CA] shrink-0" />
                          )}
                          <span className="flex-1 text-xs font-mono text-[#374151] truncate">
                            {highlightMatch(node.path, query)}
                          </span>
                          {node.language && (
                            <span className="text-[10px] text-[#5B5F66] px-1.5 py-0.5 rounded bg-[#F5F5F4] border border-[#E5E5E3]">
                              {node.language}
                            </span>
                          )}
                          <ArrowRight className="h-3 w-3 text-[#C5C5C3] opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Content matches */}
                  {contentResults.length > 0 && (
                    <div className="p-2 border-t border-[#E5E5E3]">
                      <p className="text-[10px] text-[#5B5F66] uppercase tracking-wider font-semibold px-2 py-1">
                        Code Matches
                      </p>
                      {contentResults.map((match, i) => (
                        <button
                          key={`${match.path}:${match.lineNum}:${i}`}
                          onClick={() =>
                            handleSelect(
                              `Explain this code in ${match.path} at line ${match.lineNum}: \`${match.line.slice(0, 100)}\``
                            )
                          }
                          className="w-full flex flex-col gap-1 px-3 py-2 rounded-lg hover:bg-[#F5F5F4] transition-colors text-left"
                        >
                          <div className="flex items-center gap-2">
                            <TextSearch className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            <span className="text-[11px] font-mono text-[#5B5F66] truncate">
                              {match.path}
                              <span className="text-[#4338CA]">:{match.lineNum}</span>
                            </span>
                          </div>
                          <code className="ml-5 text-[11px] text-[#374151] bg-[#F5F5F4] px-2 py-1 rounded block truncate font-mono">
                            {highlightMatch(match.line.slice(0, 120), query)}
                          </code>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Empty */}
                  {query && fileResults.length === 0 && contentResults.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-8">
                      <Search className="h-8 w-8 text-[#E5E5E3]" />
                      <p className="text-sm text-[#5B5F66]">No results found.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
