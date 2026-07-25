"use client";

import { motion } from "framer-motion";
import { FileCode2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CitationChipProps {
  filePath: string;
  startLine: number;
  endLine: number;
  onClick?: () => void;
}

export function CitationChip({ filePath, startLine, endLine, onClick }: CitationChipProps) {
  const filename = filePath.split("/").pop() ?? filePath;
  return (
    <motion.button
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05, y: -1 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono bg-[#EEF2FF] text-[#4338CA] border border-[#C7D2FE] hover:bg-[#E0E7FF] hover:border-[#A5B4FC] transition-colors cursor-pointer mx-0.5 my-0.5"
    >
      <FileCode2 className="h-3 w-3 shrink-0" />
      <span className="max-w-[140px] truncate">{filename}</span>
      <span className="text-[#6366F1] opacity-70">:{startLine}-{endLine}</span>
    </motion.button>
  );
}
