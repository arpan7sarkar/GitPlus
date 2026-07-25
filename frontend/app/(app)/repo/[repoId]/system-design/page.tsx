"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { LayoutDashboard, Loader2, Download, RefreshCw } from "lucide-react";
import { PageTransition } from "@/components/shared/page-transition";
import { useRepoStore } from "@/lib/stores/repo-store";
import { generateSystemDesign } from "@/lib/api";
import ReactMarkdown from "react-markdown";

export default function SystemDesignPage() {
  const { meta, repoContext } = useRepoStore();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const result = await generateSystemDesign(repoContext || "");
      setContent(result);
      setHasGenerated(true);
    } finally {
      setLoading(false);
    }
  };

  const downloadMd = () => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system-design-${meta?.name || "document"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <LayoutDashboard className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#111114]">System Design</h1>
              <p className="text-xs text-[#5B5F66]">AI-generated architecture document</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasGenerated && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={downloadMd}
                className="px-4 py-2 rounded-xl border border-[#E5E5E3] text-sm font-medium text-[#5B5F66] hover:text-[#111114] hover:bg-[#F5F5F4] flex items-center gap-2"
              >
                <Download className="h-4 w-4" /> .md
              </motion.button>
            )}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={generate}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold shadow-sm hover:shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {loading ? "Generating..." : hasGenerated ? "Regenerate" : "Generate"}
            </motion.button>
          </div>
        </div>

        {/* Empty state */}
        {!hasGenerated && !loading && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-2xl bg-[#F5F5F4] flex items-center justify-center mb-6">
              <LayoutDashboard className="h-8 w-8 text-[#C5C5C3]" />
            </div>
            <h2 className="text-lg font-semibold text-[#111114] mb-2">Generate System Design</h2>
            <p className="text-sm text-[#5B5F66] max-w-sm mb-6">
              AI will analyze the codebase architecture and generate a comprehensive system design document with diagrams.
            </p>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={generate}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold shadow-sm hover:shadow-md flex items-center gap-2"
            >
              <LayoutDashboard className="h-4 w-4" /> Generate Document
            </motion.button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-500 mb-4" />
            <p className="text-sm text-[#5B5F66]">Analyzing architecture and generating design document...</p>
          </div>
        )}

        {/* Content */}
        {hasGenerated && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-8"
          >
            <div className="prose-gitplus">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
}
