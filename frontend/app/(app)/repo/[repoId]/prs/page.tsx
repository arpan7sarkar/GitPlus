"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CircleDot, Clock, ExternalLink, Loader2, AlertCircle, Sparkles, X, FileDiff, CheckCircle2 } from "lucide-react";
import { PageTransition } from "@/components/shared/page-transition";
import { useRepoStore } from "@/lib/stores/repo-store";
import { fetchPullRequests, fetchPullRequestDiff, streamChat, type GitHubPullRequest } from "@/lib/api";
import { timeAgo } from "@/lib/utils";

export default function PRsPage() {
  const params = useParams();
  const router = useRouter();
  const repoId = params?.repoId as string;
  const { meta, repoContext, githubToken } = useRepoStore();

  const [pulls, setPulls] = useState<GitHubPullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "closed" | "all">("open");
  const [selectedPR, setSelectedPR] = useState<GitHubPullRequest | null>(null);
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { loadPRs(); }, [filter]);

  async function loadPRs() {
    setLoading(true); setError(null);
    try {
      const result = await fetchPullRequests(meta?.owner || "vercel", meta?.name || "next.js", filter, githubToken || undefined);
      setPulls(result);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to fetch"); }
    finally { setLoading(false); }
  }

  async function reviewPR(pr: GitHubPullRequest) {
    setSelectedPR(pr); setAiResponse(""); setAiLoading(true);
    try {
      const diff = await fetchPullRequestDiff(meta?.owner || "vercel", meta?.name || "next.js", pr.number, githubToken || undefined);
      const prompt = `Review PR #${pr.number}: ${pr.title}\nDescription: ${pr.body}\n\nDiff:\n\`\`\`diff\n${diff.slice(0, 15000)}\n\`\`\`\n\nProvide:\n1. Overview of changes\n2. Potential bugs/issues\n3. Improvement suggestions\n4. Merge recommendation`;
      await streamChat({
        messages: [{ role: "user", content: prompt }], repoContext,
        onDelta: (t) => setAiResponse(p => p + t),
        onDone: () => setAiLoading(false),
        onError: (err) => { setAiResponse(p => p + `\n\nError: ${err}`); setAiLoading(false); },
      });
    } catch (e) { setAiResponse(e instanceof Error ? e.message : "Failed"); setAiLoading(false); }
  }

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center gap-1 mb-6">
          {(["open", "closed", "all"] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === s ? "bg-white border border-[#E5E5E3] text-[#111114] shadow-sm" : "text-[#5B5F66] hover:text-[#111114]"}`}>
              {s === "open" && <CircleDot className="h-3.5 w-3.5 inline mr-1.5 text-emerald-500" />}
              {s === "closed" && <CheckCircle2 className="h-3.5 w-3.5 inline mr-1.5 text-purple-500" />}
              {s === "all" && <FileDiff className="h-3.5 w-3.5 inline mr-1.5 text-[#5B5F66]" />}
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {loading && <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-[#5B5F66]" /><span className="ml-2 text-sm text-[#5B5F66]">Fetching pull requests...</span></div>}
        {error && <div className="card p-6 border-red-200 bg-red-50"><AlertCircle className="h-5 w-5 text-red-600 inline mr-2" /><span className="text-sm text-red-700">{error}</span><button onClick={loadPRs} className="ml-3 text-xs underline text-red-700">Retry</button></div>}

        {!loading && !error && (
          <div className="card divide-y divide-[#E5E5E3]">
            {pulls.length === 0 ? <div className="p-12 text-center text-sm text-[#5B5F66]">No {filter} pull requests found.</div> :
            pulls.map(pr => (
              <motion.div key={pr.number} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 py-4 hover:bg-[#F9F9F8] transition-colors">
                <div className="flex items-start gap-3">
                  {pr.merged_at ? <CheckCircle2 className="h-4 w-4 mt-0.5 text-purple-500 shrink-0" /> :
                   pr.draft ? <FileDiff className="h-4 w-4 mt-0.5 text-[#5B5F66] shrink-0" /> :
                   <CircleDot className={`h-4 w-4 mt-0.5 shrink-0 ${pr.state === "open" ? "text-emerald-500" : "text-[#5B5F66]"}`} />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#111114]">{pr.title}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[11px] text-[#5B5F66]">#{pr.number}</span>
                          <span className="text-[11px] text-[#5B5F66]">by {pr.user.login}</span>
                          <span className="text-[11px] text-[#5B5F66] flex items-center gap-0.5"><Clock className="h-3 w-3" /> {timeAgo(pr.updated_at)}</span>
                          {pr.draft && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F5F5F4] text-[#5B5F66] border border-[#E5E5E3]">Draft</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => reviewPR(pr)} className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-teal-600 hover:bg-teal-50 transition-colors flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> Review
                        </button>
                        <a href={pr.html_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded text-[#5B5F66] hover:text-[#111114]"><ExternalLink className="h-3.5 w-3.5" /></a>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {(aiResponse || aiLoading) && selectedPR && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-50 border-t border-teal-200 bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.06)]" style={{ maxHeight: "50vh" }}>
            <div className="max-w-5xl mx-auto px-6">
              <div className="flex items-center justify-between py-3 border-b border-[#E5E5E3]">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-teal-50"><Sparkles className="h-4 w-4 text-teal-600" /></div>
                  <span className="text-sm font-semibold text-[#111114]">Review for #{selectedPR.number}</span>
                  {aiLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-600" />}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => router.push(`/repo/${repoId}/chat?q=${encodeURIComponent(`Review PR #${selectedPR.number}: ${selectedPR.title}`)}`)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-teal-600 hover:bg-teal-50">Continue in Chat</button>
                  <button onClick={() => { setAiResponse(""); setSelectedPR(null); }} className="p-1.5 rounded text-[#5B5F66] hover:text-[#111114]"><X className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="py-4 overflow-y-auto text-sm text-[#374151] leading-relaxed whitespace-pre-wrap font-mono" style={{ maxHeight: "calc(50vh - 52px)" }}>{aiResponse || "Analyzing PR diff..."}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
