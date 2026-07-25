"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Loader2, ChevronDown, ChevronUp, AlertTriangle, CheckCircle } from "lucide-react";
import { PageTransition } from "@/components/shared/page-transition";
import { SeverityBadge } from "@/components/shared/severity-badge";
import { AnimatedCounter } from "@/components/shared/animated-counter";
import { useRepoStore } from "@/lib/stores/repo-store";
import { generateSecurityScan, type SecurityFinding } from "@/lib/api";

type Severity = "critical" | "high" | "medium" | "low" | "info";

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];
const SEVERITY_COLORS: Record<Severity, { bg: string; border: string; text: string }> = {
  critical: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700" },
  high:     { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700" },
  medium:   { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700" },
  low:      { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-600" },
  info:     { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-600" },
};

export default function SecurityPage() {
  const { repoContext } = useRepoStore();
  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    runScan();
  }, []);

  const runScan = async () => {
    setLoading(true);
    try {
      const results = await generateSecurityScan(repoContext || "");
      setFindings(results);
    } finally {
      setLoading(false);
    }
  };

  const countBySeverity = (s: Severity) => findings.filter((f) => f.severity === s).length;
  const summaryCards = SEVERITY_ORDER.filter((s) => s !== "info").map((s) => ({
    severity: s,
    count: countBySeverity(s),
    ...SEVERITY_COLORS[s],
  }));

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-sm">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#111114]">Security Scan</h1>
              <p className="text-xs text-[#5B5F66]">12-point audit across secrets, XSS, injection, CORS & more</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={runScan}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white text-sm font-semibold shadow-sm hover:shadow-md disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            {loading ? "Scanning..." : "Re-scan"}
          </motion.button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-red-500 mb-4" />
            <p className="text-sm text-[#5B5F66]">Running security analysis...</p>
          </div>
        )}

        {!loading && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {summaryCards.map((card) => (
                <motion.div
                  key={card.severity}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-xl border ${card.border} ${card.bg} p-4`}
                >
                  <p className={`text-xs font-bold uppercase tracking-wider ${card.text} mb-1`}>
                    {card.severity}
                  </p>
                  <p className={`text-3xl font-bold ${card.text}`}>
                    <AnimatedCounter end={card.count} duration={0.8} />
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Findings list */}
            <div className="space-y-3">
              {findings.length === 0 && (
                <div className="text-center py-16">
                  <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-[#111114] mb-1">All Clear</p>
                  <p className="text-sm text-[#5B5F66]">No security issues detected.</p>
                </div>
              )}

              {SEVERITY_ORDER.map((severity) => {
                const items = findings.filter((f) => f.severity === severity);
                if (items.length === 0) return null;
                return items.map((finding, i) => (
                  <motion.div
                    key={finding.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="card overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedId(expandedId === finding.id ? null : finding.id)}
                      className="w-full flex items-center gap-4 px-5 py-4 text-left"
                    >
                      <SeverityBadge severity={finding.severity} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#111114]">{finding.title}</p>
                        <p className="text-xs text-[#5B5F66] truncate mt-0.5">{finding.description}</p>
                      </div>
                      <span className="text-[10px] font-mono text-[#C5C5C3] shrink-0">{finding.id}</span>
                      {expandedId === finding.id
                        ? <ChevronUp className="h-4 w-4 text-[#5B5F66] shrink-0" />
                        : <ChevronDown className="h-4 w-4 text-[#5B5F66] shrink-0" />
                      }
                    </button>

                    <AnimatePresence>
                      {expandedId === finding.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 border-t border-[#E5E5E3]">
                            <div className="pt-4 space-y-4">
                              <div>
                                <p className="text-xs font-semibold text-[#5B5F66] uppercase tracking-wider mb-1">Description</p>
                                <p className="text-sm text-[#374151] leading-relaxed">{finding.description}</p>
                              </div>
                              {finding.file && (
                                <div>
                                  <p className="text-xs font-semibold text-[#5B5F66] uppercase tracking-wider mb-1">Location</p>
                                  <p className="text-xs font-mono text-[#4338CA] bg-[#EEF2FF] px-3 py-1.5 rounded-lg inline-block">
                                    {finding.file}{finding.line ? `:${finding.line}` : ""}
                                  </p>
                                </div>
                              )}
                              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                                <div className="flex items-start gap-2">
                                  <AlertTriangle className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                                  <div>
                                    <p className="text-xs font-semibold text-emerald-800 mb-1">Recommendation</p>
                                    <p className="text-sm text-emerald-700 leading-relaxed">{finding.recommendation}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ));
              })}
            </div>
          </>
        )}
      </div>
    </PageTransition>
  );
}
