"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, FileCode2, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useRepoStore } from "@/lib/stores/repo-store";

interface FileViewerProps {
  filePath: string;
  startLine?: number;
  endLine?: number;
  onClose: () => void;
}

export function FileViewer({ filePath, startLine, endLine, onClose }: FileViewerProps) {
  const { fileContents } = useRepoStore();
  const [copied, setCopied] = useState(false);

  const content = fileContents[filePath] || `// Loading ${filePath}...`;
  const lines = content.split("\n");
  const filename = filePath.split("/").pop() ?? filePath;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="h-full flex flex-col border-l border-[#E5E5E3] bg-white"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E3] bg-[#F5F5F4]">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode2 className="h-4 w-4 text-[#4338CA] shrink-0" />
          <span className="text-xs font-mono text-[#111114] truncate">{filename}</span>
          {startLine && endLine && (
            <span className="text-[10px] text-[#5B5F66] font-mono">:{startLine}-{endLine}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md text-[#5B5F66] hover:text-[#111114] hover:bg-white transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[#5B5F66] hover:text-[#111114] hover:bg-white transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Code content */}
      <div className="flex-1 overflow-auto font-mono text-xs">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, i) => {
              const lineNum = i + 1;
              const isHighlighted = startLine && endLine && lineNum >= startLine && lineNum <= endLine;
              return (
                <tr
                  key={i}
                  className={isHighlighted ? "bg-[#EEF2FF]" : "hover:bg-[#F9F9F8]"}
                >
                  <td className="px-3 py-0 text-right text-[#C5C5C3] select-none w-10 align-top border-r border-[#E5E5E3] sticky left-0 bg-inherit">
                    {lineNum}
                  </td>
                  <td className="px-4 py-0 whitespace-pre text-[#374151]">
                    {line || " "}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
