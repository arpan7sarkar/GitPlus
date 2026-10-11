import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, CircleDot, Clock,
  ExternalLink, Loader2, AlertCircle, Sparkles, X, FileDiff, CheckCircle2, Power, ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Markdown from "@/components/ui/markdown";
import { useRepoStore } from "@/lib/store";
import WorkspaceNav from "@/components/layout/WorkspaceNav";
import NoRepoLoaded from "@/components/layout/NoRepoLoaded";
import {
  fetchPullRequests, type GitHubPullRequest,
  fetchVexReviewStatus, enableVexReview, disableVexReview, triggerVexReview, fetchVexReviewRun, type VexReviewRun,
} from "@/lib/api";
import { toast } from "@/hooks/use-toast";

const POLL_INTERVAL_MS = 2000;

const RepoPRs = () => {
  const { repoId } = useParams();
  const navigate = useNavigate();
  const { meta: storeMeta, githubToken } = useRepoStore();
  const repo = storeMeta;

  const [pulls, setPulls] = useState<GitHubPullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "closed" | "all">("open");

  // VexReview enable state + per-PR run status
  const [vexEnabled, setVexEnabled] = useState(false);
  const [vexEnabling, setVexEnabling] = useState(false);
  const [vexStatusLoaded, setVexStatusLoaded] = useState(false);
  const [activeRun, setActiveRun] = useState<VexReviewRun | null>(null);
  const [selectedPR, setSelectedPR] = useState<GitHubPullRequest | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (repo) loadPullRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, repo]);

  useEffect(() => {
    if (!repo) return;
    fetchVexReviewStatus(repo.owner, repo.name)
      .then((res) => setVexEnabled(res.enabled))
      .catch((e) => console.error("[vexreview] status check failed:", e))
      .finally(() => setVexStatusLoaded(true));
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);

  async function loadPullRequests() {
    if (!repo) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPullRequests(repo.owner, repo.name, filter, githubToken || undefined);
      setPulls(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch pull requests");
    } finally {
      setLoading(false);
    }
  }

  if (!repo) {
    return (
      <div className="min-h-screen bg-background">
        <WorkspaceNav repoId={repoId ?? ""} active="prs" />
        <NoRepoLoaded repoId={repoId} />
      </div>
    );
  }

  async function handleToggleVexReview() {
    setVexEnabling(true);
    try {
      if (vexEnabled) {
        await disableVexReview(repo.owner, repo.name);
        setVexEnabled(false);
        toast({ title: "VexReview disabled", description: `Turned off for ${repo.owner}/${repo.name}.` });
      } else {
        await enableVexReview(repo.owner, repo.name);
        setVexEnabled(true);
        toast({ title: "VexReview enabled", description: "You can now review any PR in this repo with one click." });
      }
    } catch (e) {
      toast({
        title: "Couldn't update VexReview",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setVexEnabling(false);
    }
  }

  function pollRun(runId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const run = await fetchVexReviewRun(runId);
        setActiveRun(run);
        if (run.status === "completed" || run.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          if (run.status === "completed") {
            loadPullRequests(); // refresh so comment counts etc. stay current
          }
        }
      } catch (e) {
        console.error("[vexreview] poll failed:", e);
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, POLL_INTERVAL_MS);
  }

  async function reviewPR(pr: GitHubPullRequest) {
    setSelectedPR(pr);
    setActiveRun(null);
    try {
      const { runId } = await triggerVexReview(repo.owner, repo.name, pr.number);
      setActiveRun({
        id: runId,
        configId: "",
        userId: "",
        prNumber: pr.number,
        status: "queued",
        stage: "diffing",
        stageMessage: "Starting review...",
        resultStatus: null,
        filesReviewed: null,
        reviewComments: null,
        lgtmCount: null,
        error: null,
        startedAt: new Date().toISOString(),
        completedAt: null,
      });
      pollRun(runId);
    } catch (e) {
      toast({
        title: "Couldn't start review",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
      setSelectedPR(null);
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days > 30) return `${Math.floor(days / 30)}mo ago`;
    if (days > 0) return `${days}d ago`;
    const hours = Math.floor(diff / 3600000);
    if (hours > 0) return `${hours}h ago`;
    return "just now";
  }

  return (
    <div className="min-h-screen bg-background">
      <WorkspaceNav
        repoId={repoId ?? ""}
        owner={repo.owner}
        name={repo.name}
        active="prs"
        actions={
          <Button onClick={() => navigate(`/repo/${repoId}/chat`)} size="sm" className="h-11 sm:h-9 px-3 text-sm rounded-md">
            <MessageSquare className="h-3 w-3 mr-1" aria-hidden="true" /> Chat
          </Button>
        }
      />

      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <h1 className="mb-4 text-2xl font-semibold">Pull requests</h1>
        {/* VexReview enable banner */}
        {vexStatusLoaded && (
          <div className="mb-4 p-3 rounded-lg border border-border bg-card flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Sparkles className={`h-4 w-4 ${vexEnabled ? "text-success" : "text-muted-foreground"}`} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  VexReview {vexEnabled ? "is enabled for this repo" : "— AI PR reviewer"}
                </p>
                <p className="text-sm text-secondary-foreground break-words">
                  {vexEnabled
                    ? "Click \"Review\" on any PR to post an AI code review."
                    : "Requires write access to this repo. Reviews run on GitPlus's own LLM keys and post real GitHub review comments as you."}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant={vexEnabled ? "outline" : "default"}
              onClick={handleToggleVexReview}
              disabled={vexEnabling}
              className="h-11 sm:h-9 px-3 text-sm shrink-0"
            >
              {vexEnabling ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Power className="h-3 w-3 mr-1.5" />}
              {vexEnabled ? "Disable" : "Enable"}
            </Button>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-4">
          {(["open", "closed", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              aria-pressed={filter === s}
              className={`min-h-11 sm:min-h-9 px-3 py-1.5 text-sm rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${filter === s
                  ? "bg-card border border-border text-foreground font-medium"
                  : "text-secondary-foreground hover:text-foreground hover:bg-accent"
                }`}
            >
              {s === "open" && <CircleDot className="h-4 w-4 inline mr-1.5 text-success" aria-hidden="true" />}
              {s === "closed" && <CheckCircle2 className="h-4 w-4 inline mr-1.5 text-muted-foreground" aria-hidden="true" />}
              {s === "all" && <FileDiff className="h-4 w-4 inline mr-1.5 text-muted-foreground" aria-hidden="true" />}
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-secondary-foreground">Fetching pull requests...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground mb-1">Unable to Load Pull Requests</h3>
                <p className="text-sm text-secondary-foreground leading-relaxed mb-3 break-words">{error}</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => loadPullRequests()} className="h-11 sm:h-9 px-3 text-sm">
                    <Loader2 className={`h-3 w-3 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Retry
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pulls list */}
        {!loading && !error && (
          <div className="rounded border border-border bg-card divide-y divide-border">
            {pulls.length === 0 ? (
              <div className="p-8 text-center text-sm text-secondary-foreground">
                No {filter} pull requests found.
              </div>
            ) : (
              pulls.map((pr) => (
                <motion.div
                  key={pr.number}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-3 hover:bg-accent transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {pr.merged_at ? (
                      <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-success" />
                    ) : pr.draft ? (
                      <FileDiff className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <CircleDot className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${pr.state === "open" ? "text-success" : "text-muted-foreground"}`} />
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 basis-48">
                          <button
                            onClick={() => setSelectedPR(selectedPR?.number === pr.number ? null : pr)}
                            aria-expanded={selectedPR?.number === pr.number}
                            className="min-h-11 w-full rounded-sm py-1 text-left text-sm font-medium text-foreground [overflow-wrap:anywhere] hover:underline sm:min-h-9"
                          >
                            {pr.title}
                          </button>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-muted-foreground">
                              #{pr.number}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              by {pr.user.login}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" /> {timeAgo(pr.updated_at)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!vexEnabled || (activeRun?.prNumber === pr.number && activeRun.status !== "completed" && activeRun.status !== "failed")}
                            title={vexEnabled ? undefined : "Enable VexReview above to review PRs"}
                            className="h-11 px-3 text-sm text-primary hover:bg-accent hover:text-foreground sm:h-9"
                            onClick={() => reviewPR(pr)}
                          >
                            {activeRun?.prNumber === pr.number && activeRun.status !== "completed" && activeRun.status !== "failed" ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Sparkles className="h-3 w-3 mr-1" />
                            )}
                            Review
                          </Button>
                          <a
                            href={pr.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open pull request #${pr.number} on GitHub`}
                            className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:h-9 sm:w-9"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>

                      {/* Expanded body */}
                      <AnimatePresence>
                        {selectedPR?.number === pr.number && !activeRun && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 p-3 rounded bg-muted/50 text-sm text-secondary-foreground leading-relaxed max-h-40 overflow-y-auto">
                              {pr.body ? <Markdown>{pr.body}</Markdown> : "No description provided."}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </main>

      {/* VexReview Run Status Panel */}
      <AnimatePresence>
        {activeRun && selectedPR && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background shadow-lg"
          >
            <div className="max-w-5xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-muted">
                    <Sparkles className="h-3.5 w-3.5 text-success" />
                  </div>
                  <span className="text-xs font-medium text-foreground">
                    VexReview for #{selectedPR.number}
                  </span>
                  {(activeRun.status === "queued" || activeRun.status === "running") && (
                    <Loader2 className="h-3 w-3 animate-spin text-success ml-1" />
                  )}
                </div>
                <button
                  onClick={() => { setActiveRun(null); setSelectedPR(null); if (pollRef.current) clearInterval(pollRef.current); }}
                    aria-label="Close review status"
                    className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:h-9 sm:w-9"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {(activeRun.status === "queued" || activeRun.status === "running") && (
                <p className="text-xs text-muted-foreground">
                  {activeRun.stageMessage || "Working..."}
                </p>
              )}

              {activeRun.status === "failed" && (
                <div className="flex items-start gap-2 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{activeRun.error || "Review failed for an unknown reason."}</span>
                </div>
              )}

              {activeRun.status === "completed" && activeRun.resultStatus === "reviewed" && (
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    Reviewed {activeRun.filesReviewed} file{activeRun.filesReviewed === 1 ? "" : "s"}
                  </span>
                  <span className="text-muted-foreground">{activeRun.reviewComments} comment{activeRun.reviewComments === 1 ? "" : "s"}</span>
                  <span className="text-muted-foreground">{activeRun.lgtmCount} LGTM</span>
                  <a
                    href={selectedPR.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto flex items-center gap-1 text-success hover:text-foreground"
                  >
                    View review on GitHub <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {activeRun.status === "completed" && activeRun.resultStatus === "rejected_sensitive_files" && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-warning">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>Sensitive files detected — review skipped. Check the PR comment for details.</span>
                  <a href={selectedPR.html_url} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 text-success hover:text-foreground">
                    View on GitHub <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {activeRun.status === "completed" && activeRun.resultStatus === "skipped" && (
                <p className="text-xs text-muted-foreground">
                  {activeRun.stageMessage || "Nothing to review."}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RepoPRs;
