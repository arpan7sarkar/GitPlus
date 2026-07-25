"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Star, Files, Box, BarChart3, MessageSquare,
  Shield, FileText, Network, ArrowRight, Sparkles, Loader2,
} from "lucide-react";
import { PageTransition } from "@/components/shared/page-transition";
import { AnimatedCounter } from "@/components/shared/animated-counter";
import { useRepoStore } from "@/lib/stores/repo-store";
import { generateOverview } from "@/lib/api";
import { MOCK_GRAPH_NODES, MOCK_GRAPH_LINKS } from "@/lib/mock-data/graph";
import { CodebaseSearch } from "@/components/app/codebase-search";

const stagger = {
  parent: { animate: { transition: { staggerChildren: 0.06 } } },
  child: { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } },
};

export default function RepoDashboard() {
  const params = useParams();
  const router = useRouter();
  const repoId = params?.repoId as string;
  const { meta, overview, setOverview, repoContext, indexMode, totalSourceFiles, setRepoData } = useRepoStore();

  const [loadingOverview, setLoadingOverview] = useState(false);

  useEffect(() => {
    if (!meta && repoId) {
      const cached = localStorage.getItem(`repo_${repoId}`);
      if (cached) {
        try {
          const result = JSON.parse(cached);
          setRepoData(result);
        } catch {
          router.push("/");
        }
      } else {
        router.push("/");
      }
    }
  }, [meta, repoId, router, setRepoData]);

  useEffect(() => {
    if (!overview && repoContext) {
      setLoadingOverview(true);
      generateOverview(repoContext)
        .then((o) => setOverview(o))
        .finally(() => setLoadingOverview(false));
    }
  }, [overview, repoContext, setOverview]);

  const stats = [
    { label: "Stars", value: meta?.stars ?? 0, icon: Star, suffix: "" },
    { label: "Files", value: meta?.fileCount ?? 0, icon: Files, suffix: "" },
    { label: "Framework", value: overview?.framework ?? meta?.framework ?? "—", icon: Box, isText: true },
    { label: "Complexity", value: overview?.complexity ?? "—", icon: BarChart3, isText: true },
  ];

  const quickActions = [
    { label: "Chat", href: `/repo/${repoId}/chat`, icon: MessageSquare, gradient: "from-blue-500 to-indigo-600" },
    { label: "Security", href: `/repo/${repoId}/security`, icon: Shield, gradient: "from-red-500 to-rose-600" },
    { label: "System Design", href: `/repo/${repoId}/system-design`, icon: Network, gradient: "from-emerald-500 to-teal-600" },
    { label: "Onboarding", href: `/repo/${repoId}/onboarding`, icon: FileText, gradient: "from-amber-500 to-orange-600" },
  ];

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* On-demand mode banner */}
        {indexMode === "on-demand" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 px-5 py-3 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] text-sm flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4 text-[#D97706]" />
            <span className="text-[#92400E]">
              <strong>On-Demand Mode:</strong> Large repo ({totalSourceFiles} files). Files are loaded lazily when opened.
            </span>
          </motion.div>
        )}
        {/* Codebase search */}
        <div className="mb-6">
          <CodebaseSearch repoId={repoId} />
        </div>

        {/* Stats strip */}
        <motion.div
          variants={stagger.parent}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          {stats.map((stat) => (
            <motion.div
              key={stat.label}
              variants={stagger.child}
              className="card px-5 py-4"
            >
              <div className="flex items-center gap-2 text-[#5B5F66] mb-2">
                <stat.icon className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">{stat.label}</span>
              </div>
              {stat.isText ? (
                <p className="text-lg font-bold text-[#111114]">{String(stat.value)}</p>
              ) : (
                <p className="text-lg font-bold text-[#111114]">
                  <AnimatedCounter end={Number(stat.value)} />
                </p>
              )}
            </motion.div>
          ))}
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main content — 2 cols */}
          <div className="lg:col-span-2 space-y-6">
            {/* Architecture Overview */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card p-6"
            >
              <h2 className="text-sm font-semibold text-[#111114] uppercase tracking-wider mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#4338CA]" />
                Architecture Overview
              </h2>
              {loadingOverview ? (
                <div className="flex items-center gap-2 py-8 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-[#4338CA]" />
                  <span className="text-sm text-[#5B5F66]">Analyzing architecture...</span>
                </div>
              ) : overview ? (
                <p className="text-sm text-[#374151] leading-relaxed">{overview.narrative}</p>
              ) : (
                <p className="text-sm text-[#5B5F66] italic">No overview available.</p>
              )}
            </motion.div>

            {/* Key Files */}
            {overview?.keyFiles && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="card p-6"
              >
                <h2 className="text-sm font-semibold text-[#111114] uppercase tracking-wider mb-4">
                  Key Files
                </h2>
                <div className="space-y-2">
                  {overview.keyFiles.map((file) => (
                    <button
                      key={file}
                      onClick={() => router.push(`/repo/${repoId}/chat`)}
                      className="w-full text-left px-4 py-2.5 rounded-lg bg-[#F5F5F4] hover:bg-[#EEF2FF] text-xs font-mono text-[#374151] hover:text-[#4338CA] transition-colors border border-transparent hover:border-[#C7D2FE]"
                    >
                      {file}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Dependencies */}
            {overview?.mainDeps && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="card p-6"
              >
                <h2 className="text-sm font-semibold text-[#111114] uppercase tracking-wider mb-4">
                  Dependencies
                </h2>
                <div className="flex flex-wrap gap-2">
                  {overview.mainDeps.map((dep) => (
                    <span
                      key={dep}
                      className="px-3 py-1.5 rounded-lg bg-[#F5F5F4] border border-[#E5E5E3] text-xs font-mono text-[#5B5F66]"
                    >
                      {dep}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Suggested Questions */}
            {overview?.suggestedQs && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="card p-6"
              >
                <h2 className="text-sm font-semibold text-[#111114] uppercase tracking-wider mb-4">
                  Suggested Questions
                </h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {overview.suggestedQs.map((q) => (
                    <button
                      key={q}
                      onClick={() =>
                        router.push(`/repo/${repoId}/chat?q=${encodeURIComponent(q)}`)
                      }
                      className="text-left px-4 py-3 rounded-xl bg-[#FAFAFA] border border-[#E5E5E3] text-sm text-[#374151] hover:border-[#C7D2FE] hover:bg-[#EEF2FF] hover:text-[#4338CA] transition-all group"
                    >
                      <span className="flex items-start gap-2">
                        <MessageSquare className="h-4 w-4 mt-0.5 text-[#C5C5C3] group-hover:text-[#4338CA] transition-colors shrink-0" />
                        {q}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Sidebar — 1 col */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="card p-6"
            >
              <h2 className="text-sm font-semibold text-[#111114] uppercase tracking-wider mb-4">
                Quick Actions
              </h2>
              <div className="space-y-2">
                {quickActions.map((action) => (
                  <motion.button
                    key={action.label}
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.push(action.href)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left hover:bg-[#F5F5F4] transition-colors group"
                  >
                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${action.gradient} flex items-center justify-center shadow-sm`}>
                      <action.icon className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm font-medium text-[#111114] flex-1">{action.label}</span>
                    <ArrowRight className="h-4 w-4 text-[#C5C5C3] group-hover:text-[#4338CA] transition-colors" />
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Dependency graph mini */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="card p-6"
            >
              <h2 className="text-sm font-semibold text-[#111114] uppercase tracking-wider mb-4 flex items-center gap-2">
                <Network className="h-4 w-4 text-[#4338CA]" />
                Module Graph
              </h2>
              <div className="relative h-40 bg-[#F5F5F4] rounded-xl overflow-hidden flex items-center justify-center">
                {/* Mini graph preview */}
                {MOCK_GRAPH_NODES.slice(0, 6).map((node, i) => (
                  <motion.div
                    key={node.id}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    className="absolute"
                    style={{
                      left: `${20 + (i % 3) * 30}%`,
                      top: `${20 + Math.floor(i / 3) * 40}%`,
                    }}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[7px] font-bold text-white shadow-sm ${
                      node.type === "entry" ? "bg-[#4338CA]" :
                      node.type === "external" ? "bg-[#6B7280]" :
                      "bg-[#6366F1]"
                    }`}>
                      {node.label.slice(0, 3)}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Info badge */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="card p-5 bg-gradient-to-br from-[#EEF2FF] to-white border-[#C7D2FE]"
            >
              <p className="text-xs text-[#4338CA] font-semibold mb-1">Repo Language</p>
              <p className="text-2xl font-bold text-[#111114]">{meta?.language ?? "TypeScript"}</p>
              <p className="text-xs text-[#5B5F66] mt-1">Primary language detected</p>
            </motion.div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
