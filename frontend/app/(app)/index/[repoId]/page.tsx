"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Terminal, AlertCircle, KeyRound } from "lucide-react";
import { Stepper } from "@/components/app/stepper";
import { PageTransition } from "@/components/shared/page-transition";
import { indexRepository } from "@/lib/api";
import { useRepoStore } from "@/lib/stores/repo-store";

const STAGES = [
  "Validating Repository URL",
  "Fetching Git Tree & Directory Structure",
  "Extracting Skeleton Files & Context",
  "Building Codebase Intelligence Model",
];

export default function IndexingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const repoId = params?.repoId as string;
  const repoUrl = searchParams?.get("url") ?? "";

  const { setRepoData, setIndexing, addTerminalLog } = useRepoStore();

  const [currentStage, setCurrentStage] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [patInput, setPatInput] = useState("");
  const [showPat, setShowPat] = useState(false);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    addTerminalLog(msg);
  }, [addTerminalLog]);

  const startIndexing = useCallback(async (token?: string) => {
    setError(null);
    setCurrentStage(0);
    setLogs([]);
    setIndexing(true, 0, "Starting...");
    addLog(`Indexing ${repoUrl || "demo repository"}...`);

    try {
      const result = await indexRepository(
        repoUrl || "https://github.com/vercel/next.js",
        token,
        (stage, message) => {
          setCurrentStage(stage);
          setIndexing(true, stage, message);
          addLog(message);
        }
      );

      addLog("✓ Indexing complete!");
      setIndexing(false);

      setRepoData({
        repoId: result.repoId,
        meta: result.meta,
        fileTree: result.fileTree,
        fileContents: result.fileContents,
        repoContext: result.repoContext,
        githubToken: token,
        indexMode: result.indexMode,
        totalSourceFiles: result.totalSourceFiles,
        unfetchedFiles: result.unfetchedFiles,
      });

      // Navigate to dashboard
      setTimeout(() => {
        router.push(`/repo/${result.repoId}`);
      }, 500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Indexing failed";
      setError(msg);
      addLog(`✗ Error: ${msg}`);
      setIndexing(false);
      if (msg.includes("403") || msg.includes("rate limit") || msg.includes("private")) {
        setShowPat(true);
      }
    }
  }, [repoUrl, setRepoData, setIndexing, addLog, router]);

  useEffect(() => {
    startIndexing();
  }, [startIndexing]);

  const handlePatRetry = () => {
    if (!patInput.trim()) return;
    setShowPat(false);
    startIndexing(patInput.trim());
  };

  return (
    <PageTransition>
      <div className="min-h-[80vh] flex items-center justify-center px-6 py-16">
        <div className="max-w-lg w-full">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#4338CA] to-[#6366F1] flex items-center justify-center mx-auto mb-5 shadow-md">
              <Terminal className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[#111114] mb-2">Indexing Repository</h1>
            <p className="text-sm text-[#5B5F66] font-mono truncate max-w-xs mx-auto">
              {repoUrl || "vercel/next.js"}
            </p>
          </motion.div>

          {/* Error state */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 p-5 rounded-xl bg-red-50 border border-red-200"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-800 mb-1">Indexing Failed</p>
                  <p className="text-xs text-red-600 leading-relaxed">{error}</p>
                </div>
              </div>

              {showPat && (
                <div className="mt-4 pt-4 border-t border-red-200">
                  <div className="flex items-center gap-2 mb-3">
                    <KeyRound className="h-4 w-4 text-red-600" />
                    <span className="text-xs font-semibold text-red-800">Personal Access Token Required</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={patInput}
                      onChange={(e) => setPatInput(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxx"
                      className="flex-1 px-3 py-2 rounded-lg border border-red-200 bg-white text-xs font-mono focus:outline-none focus:border-[#4338CA] focus:ring-2 focus:ring-[#4338CA]/10"
                    />
                    <button
                      onClick={handlePatRetry}
                      className="px-4 py-2 rounded-lg bg-[#4338CA] text-white text-xs font-semibold hover:bg-[#3730A3] transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {!showPat && (
                <button
                  onClick={() => startIndexing()}
                  className="mt-4 px-4 py-2 rounded-lg bg-white border border-red-200 text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors"
                >
                  Retry
                </button>
              )}
            </motion.div>
          )}

          {/* Stepper */}
          {!error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-10"
            >
              <Stepper steps={STAGES} currentStep={currentStage} />
            </motion.div>
          )}

          {/* Terminal logs */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl bg-[#1E1E2E] border border-[#313244] overflow-hidden shadow-lg"
          >
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#313244]">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#F38BA8]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#FAB387]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#A6E3A1]" />
              </div>
              <span className="text-[10px] text-[#6C7086] font-mono ml-2">terminal</span>
            </div>
            <div className="p-4 max-h-48 overflow-y-auto font-mono text-xs space-y-1">
              {logs.map((log, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`${
                    log.includes("✓") ? "text-[#A6E3A1]" : log.includes("✗") ? "text-[#F38BA8]" : "text-[#CDD6F4]"
                  }`}
                >
                  {log}
                </motion.div>
              ))}
              {!error && (
                <span className="inline-block w-2 h-3.5 bg-[#CDD6F4] animate-pulse rounded-sm" />
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
}
