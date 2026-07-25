"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, File, Folder, FolderOpen } from "lucide-react";
import type { FileNode } from "@/lib/api";
import { cn } from "@/lib/utils";

interface FileExplorerProps {
  files: FileNode[];
  onFileSelect?: (path: string) => void;
  activeFile?: string | null;
}

function FileTreeNode({ node, depth, onFileSelect, activeFile }: {
  node: FileNode; depth: number; onFileSelect?: (path: string) => void; activeFile?: string | null;
}) {
  const [isOpen, setIsOpen] = useState(depth < 2);
  const isDir = node.type === "dir";
  const name = node.path.split("/").pop() ?? node.path;
  const isActive = activeFile === node.path;

  return (
    <div>
      <button
        onClick={() => {
          if (isDir) setIsOpen(!isOpen);
          else onFileSelect?.(node.path);
        }}
        className={cn(
          "flex items-center gap-1.5 w-full text-left py-1 px-2 rounded-md text-[12px] hover:bg-[#F5F5F4] transition-colors group",
          isActive && "bg-[#EEF2FF] text-[#4338CA]"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {isDir ? (
          <>
            <motion.span
              animate={{ rotate: isOpen ? 90 : 0 }}
              transition={{ duration: 0.15 }}
              className="shrink-0"
            >
              <ChevronRight className="h-3 w-3 text-[#5B5F66]" />
            </motion.span>
            {isOpen
              ? <FolderOpen className="h-3.5 w-3.5 text-[#F59E0B] shrink-0" />
              : <Folder className="h-3.5 w-3.5 text-[#F59E0B] shrink-0" />
            }
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            <File className="h-3.5 w-3.5 text-[#5B5F66] shrink-0" />
          </>
        )}
        <span className={cn(
          "truncate font-mono",
          isDir ? "font-medium text-[#111114]" : "text-[#5B5F66] group-hover:text-[#111114]",
          isActive && "text-[#4338CA] font-medium"
        )}>
          {name}
        </span>
      </button>

      <AnimatePresence>
        {isDir && isOpen && node.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            {node.children.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                onFileSelect={onFileSelect}
                activeFile={activeFile}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FileExplorer({ files, onFileSelect, activeFile }: FileExplorerProps) {
  return (
    <div className="py-2 overflow-y-auto">
      {files.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          depth={0}
          onFileSelect={onFileSelect}
          activeFile={activeFile}
        />
      ))}
    </div>
  );
}
