"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { GitCommit, Clock, ExternalLink, Loader2, AlertCircle, Sparkles, X } from "lucide-react";
import { PageTransition } from "@/components/shared/page-transition";
import { useRepoStore } from "@/lib/stores/repo-store";
import { fetchCommits, streamChat, type GitHubCommit } from "@/lib/api";
import { timeAgo } from "@/lib/utils";

export default function CommitsPage() {
  const params = useParams();
  const router = useRouter();
  const repoId = params?.repoId as string;
  const { meta, repoContext, githubToken } = useRepoStore();

  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<GitHubCommit | null>(null);
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { loadCommits(); }, []);

  async function loadCommits() {
    setLoading(true); setError(null);
    try {
      const result = await fetchCommits(meta?.owner || "vercel", meta?.name || "next.js", githubToken || undefined);
      setCommits(result);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to fetch commits"); }
    finally { setLoading(false); }
  }

  async function explainCommit(c: GitHubCommit) {
    setSelectedCommit(c); setAiResponse(""); setAiLoading(true);
    const prompt = `Explain this commit:\n\n**SHA:** ${c.sha}\n**Message:** ${c.commit.message}\n\nBased on the codebase context, what is this commit doing? What impact does it have?`;
    await streamChat({
      messages: [{ role: "user", content: prompt }], repoContext,
      onDelta: (t) => setAiResponse(p => p + t),
      onDone: () => setAiLoading(false),
      onError: (err) => { setAiResponse(`Error: ${err}`); setAiLoading(false); },
    });
  }

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center gap-2 mb-6">
          <GitCommit className="h-5 w-5 text-[#4338CA]" />
          <h2 className="text-lg font-bold text-[#111114]">Recent Commits</h2>
        </div>

        {loading && <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-[#5B5F66]" /><span className="ml-2 text-sm text-[#5B5F66]">Fetching commits...</span></div>}
        {error && <div className="card p-6 border-red-200 bg-red-50"><AlertCircle className="h-5 w-5 text-red-600 inline mr-2" /><span className="text-sm text-red-700">{error}</span><button onClick={loadCommits} className="ml-3 text-xs underline text-red-700">Retry</button></div>}

        {!loading && !error && (
          <div className="card divide-y divide-[#E5E5E3]">
            {commits.length === 0 ? <div className="p-12 text-center text-sm text-[#5B5F66]">No commits found.</div> :
            commits.map(c => (
              <motion.div key={c.sha} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 py-4 hover:bg-[#F9F9F8] transition-colors">
                <div className="flex items-start gap-3">
                  <GitCommit className="h-4 w-4 mt-0.5 text-[#5B5F66] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#111114]">{c.commit.message.split("\n")[0]}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[10px] font-mono bg-[#F5F5F4] text-[#5B5F66] px-2 py-0.5 rounded border border-[#E5E5E3]">{c.sha.slice(0, 7)}</span>
                          <span className="text-[11px] text-[#5B5F66]">by {c.author?.login || c.commit.author.name}</span>
                          <span className="text-[11px] text-[#5B5F66] flex items-center gap-0.5"><Clock className="h-3 w-3" /> {timeAgo(c.commit.author.date)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => explainCommit(c)} className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-[#4338CA] hover:bg-[#EEF2FF] transition-colors flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> Explain
                        </button>
                        <a href={c.html_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded text-[#5B5F66] hover:text-[#111114]"><ExternalLink className="h-3.5 w-3.5" /></a>
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
        {(aiResponse || aiLoading) && selectedCommit && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#E5E5E3] bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.06)]" style={{ maxHeight: "50vh" }}>
            <div className="max-w-5xl mx-auto px-6">
              <div className="flex items-center justify-between py-3 border-b border-[#E5E5E3]">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#4338CA]" />
                  <span className="text-sm font-semibold text-[#111114]">Commit: {selectedCommit.sha.slice(0, 7)}</span>
                  {aiLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#4338CA]" />}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => router.push(`/repo/${repoId}/chat?q=${encodeURIComponent(`Explain commit ${selectedCommit.sha.slice(0, 7)}: ${selectedCommit.commit.message}`)}`)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#4338CA] hover:bg-[#EEF2FF]">Continue in Chat</button>
                  <button onClick={() => { setAiResponse(""); setSelectedCommit(null); }} className="p-1.5 rounded text-[#5B5F66] hover:text-[#111114]"><X className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="py-4 overflow-y-auto text-sm text-[#374151] leading-relaxed whitespace-pre-wrap font-mono" style={{ maxHeight: "calc(50vh - 52px)" }}>{aiResponse || "Analyzing commit..."}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
