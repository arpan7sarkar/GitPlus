"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Loader2, Download, Copy, Check } from "lucide-react";
import { PageTransition } from "@/components/shared/page-transition";
import { useRepoStore } from "@/lib/stores/repo-store";
import { generateOnboardingDoc } from "@/lib/api";
import ReactMarkdown from "react-markdown";

export default function OnboardingPage() {
  const { meta, repoContext } = useRepoStore();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const result = await generateOnboardingDoc(repoContext || "");
      setContent(result);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${meta?.name || "onboarding"}-onboarding.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#111114]">Onboarding Guide</h1>
              <p className="text-xs text-[#5B5F66]">AI-generated developer onboarding document</p>
            </div>
          </div>
          {content && (
            <div className="flex items-center gap-2">
              <button onClick={handleCopy} className="px-3 py-2 rounded-xl border border-[#E5E5E3] text-sm font-medium text-[#5B5F66] hover:text-[#111114] hover:bg-[#F5F5F4] flex items-center gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button onClick={handleDownload} className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-sm hover:shadow-md flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5" /> Download .md
              </button>
            </div>
          )}
        </div>

        {!content && !loading && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-2xl bg-[#FEF3C7] flex items-center justify-center mb-6">
              <BookOpen className="h-8 w-8 text-[#D97706]" />
            </div>
            <h2 className="text-lg font-semibold text-[#111114] mb-2">Generate Onboarding Guide</h2>
            <p className="text-sm text-[#5B5F66] max-w-md mb-6">
              AI will analyze the codebase and generate a comprehensive onboarding document with setup instructions, key files, architecture patterns, and gotchas.
            </p>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={generate}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold shadow-sm hover:shadow-md flex items-center gap-2"
            >
              <BookOpen className="h-4 w-4" /> Generate Guide
            </motion.button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-10 w-10 animate-spin text-amber-500 mb-4" />
            <p className="text-sm text-[#5B5F66]">Analyzing codebase and generating guide...</p>
          </div>
        )}

        {content && !loading && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="card p-8">
            <div className="prose-gitplus">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
}
