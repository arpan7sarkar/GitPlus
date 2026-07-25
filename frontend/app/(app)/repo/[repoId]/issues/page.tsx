"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CircleDot, Clock, MessageSquare, ExternalLink, Loader2, AlertCircle, Sparkles, X } from "lucide-react";
import { PageTransition } from "@/components/shared/page-transition";
import { useRepoStore } from "@/lib/stores/repo-store";
import { fetchIssues, streamChat, type GitHubIssue } from "@/lib/api";
import { timeAgo } from "@/lib/utils";

export default function IssuesPage() {
  const params = useParams();
  const router = useRouter();
  const repoId = params?.repoId as string;
  const { meta, repoContext, githubToken } = useRepoStore();

  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "closed">("open");
  const [selectedIssue, setSelectedIssue] = useState<GitHubIssue | null>(null);
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { loadIssues(); }, [filter]);

  async function loadIssues() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchIssues(meta?.owner || "vercel", meta?.name || "next.js", filter, githubToken || undefined);
      setIssues(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch issues");
    } finally {
      setLoading(false);
    }
  }

  async function solveIssue(issue: GitHubIssue) {
    setSelectedIssue(issue);
    setAiResponse("");
    setAiLoading(true);
    const prompt = `Solve this GitHub issue:\n\n**Issue #${issue.number}: ${issue.title}**\nLabels: ${issue.labels.map(l => l.name).join(", ") || "none"}\n\n${issue.body}\n\n---\nProvide:\n1. Root cause explanation\n2. Files that need changes\n3. Exact code changes (before/after)\n4. Edge cases to watch out for`;
    await streamChat({
      messages: [{ role: "user", content: prompt }],
      repoContext,
      onDelta: (t) => setAiResponse(prev => prev + t),
      onDone: () => setAiLoading(false),
      onError: (err) => { setAiResponse(`Error: ${err}`); setAiLoading(false); },
    });
  }

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center gap-1 mb-6">
          {(["open", "closed"] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === s ? "bg-white border border-[#E5E5E3] text-[#111114] shadow-sm" : "text-[#5B5F66] hover:text-[#111114]"}`}>
              <CircleDot className={`h-3.5 w-3.5 inline mr-1.5 ${s === "open" ? "text-emerald-500" : "text-[#5B5F66]"}`} />
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {loading && <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-[#5B5F66]" /><span className="ml-2 text-sm text-[#5B5F66]">Fetching issues...</span></div>}

        {error && (
          <div className="card p-6 border-red-200 bg-red-50">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div><p className="text-sm font-semibold text-red-800 mb-1">Failed to Load Issues</p><p className="text-xs text-red-600">{error}</p>
                <button onClick={loadIssues} className="mt-3 px-3 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-700 hover:bg-red-100">Retry</button>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="card divide-y divide-[#E5E5E3]">
            {issues.length === 0 ? (
              <div className="p-12 text-center text-sm text-[#5B5F66]">No {filter} issues found.</div>
            ) : issues.map(issue => (
              <motion.div key={issue.number} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 py-4 hover:bg-[#F9F9F8] transition-colors">
                <div className="flex items-start gap-3">
                  <CircleDot className={`h-4 w-4 mt-0.5 shrink-0 ${issue.state === "open" ? "text-emerald-500" : "text-[#5B5F66]"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#111114] hover:text-[#4338CA] cursor-pointer transition-colors">{issue.title}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[11px] text-[#5B5F66]">#{issue.number}</span>
                          {issue.labels.map(l => (
                            <span key={l.name} className="text-[10px] px-2 py-0.5 rounded-full border" style={{ backgroundColor: `#${l.color}15`, color: `#${l.color}`, borderColor: `#${l.color}40` }}>{l.name}</span>
                          ))}
                          <span className="text-[11px] text-[#5B5F66] flex items-center gap-0.5"><Clock className="h-3 w-3" /> {timeAgo(issue.updated_at)}</span>
                          {issue.comments > 0 && <span className="text-[11px] text-[#5B5F66] flex items-center gap-0.5"><MessageSquare className="h-3 w-3" /> {issue.comments}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => solveIssue(issue)} className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-[#4338CA] hover:bg-[#EEF2FF] transition-colors flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> Solve
                        </button>
                        <a href={issue.html_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded text-[#5B5F66] hover:text-[#111114]"><ExternalLink className="h-3.5 w-3.5" /></a>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* AI Solution Panel */}
      <AnimatePresence>
        {(aiResponse || aiLoading) && selectedIssue && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#E5E5E3] bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.06)]" style={{ maxHeight: "50vh" }}>
            <div className="max-w-5xl mx-auto px-6">
              <div className="flex items-center justify-between py-3 border-b border-[#E5E5E3]">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#4338CA]" />
                  <span className="text-sm font-semibold text-[#111114]">Solution for #{selectedIssue.number}</span>
                  {aiLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#4338CA]" />}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => router.push(`/repo/${repoId}/chat?q=${encodeURIComponent(`Solve issue #${selectedIssue.number}: ${selectedIssue.title}`)}`)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#4338CA] hover:bg-[#EEF2FF]">Continue in Chat</button>
                  <button onClick={() => { setAiResponse(""); setSelectedIssue(null); }} className="p-1.5 rounded text-[#5B5F66] hover:text-[#111114]"><X className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="py-4 overflow-y-auto text-sm text-[#374151] leading-relaxed whitespace-pre-wrap font-mono" style={{ maxHeight: "calc(50vh - 52px)" }}>
                {aiResponse || "Analyzing issue..."}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
