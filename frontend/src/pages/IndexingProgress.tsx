import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Loader2, GitBranch, Cpu, Database, AlertCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { indexRepository, generateOverview, ingestCodeChunks } from "@/lib/api";
import { useRepoStore } from "@/lib/store";
import { useUserAuth } from "@/hooks/use-user-auth";
import { toast } from "@/hooks/use-toast";
import { useSettingsStore } from "@/lib/settings-store";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { safeSetRepoCache } from "@/lib/repo-cache";

const STAGES = [
  { label: "Fetching repository", icon: GitBranch },
  { label: "Indexing for search", icon: Cpu },
  { label: "Generating overview", icon: Database },
];

type IngestState = "idle" | "active" | "done" | "error";

const IndexingProgress = () => {
  const { repoId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { setRepoData, setOverview, setIndexing } = useRepoStore();
  const { session, loading: authLoading } = useUserAuth();
  const { settings } = useSettingsStore();

  const [currentStage, setCurrentStage] = useState(0);
  const [fileCount, setFileCount] = useState(0);
  const [ingestState, setIngestState] = useState<IngestState>("idle");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [githubToken, setGithubToken] = useState<string | undefined>();
  const [newToken, setNewToken] = useState("");
  const [isOnDemand, setIsOnDemand] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    const state = location.state as { githubUrl?: string; githubToken?: string } | null;
    if (state?.githubUrl) setGithubUrl(state.githubUrl);
    
    // Prioritize manual token from state, fallback to session provider token
    if (state?.githubToken) {
      setGithubToken(state.githubToken);
    } else if (session?.provider_token) {
      setGithubToken(session.provider_token);
    }
  }, [location.state, session]);

  useEffect(() => {
    // Wait for the initial auth check to settle before deciding whether to wait
    // for a token — otherwise `session` is still null during that brief window
    // and indexing fires unauthenticated even for a logged-in user, permanently
    // locking out a retry via `started.current` once the real token arrives.
    if (!githubUrl || authLoading || (session && !githubToken) || started.current) {
      if (session && !githubToken && githubUrl) {
        console.log("Waiting for session provider_token...");
      }
      return;
    }
    started.current = true;

    console.log("Starting indexing for:", githubUrl);
    console.log("GitHub Token present:", !!githubToken);

    const doIndex = async () => {
      try {
        // Check cache first
        if (settings.cacheIndexData) {
          const cacheKey = `repo_cache_${githubUrl}`;
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            console.log("Found cached index for:", githubUrl);
            const data = JSON.parse(cached);
            setRepoData(data);
            setCurrentStage(3);
            setDone(true);
            setIndexing(false);
            setTimeout(() => navigate(`/repo/${data.repoId}`), 800);
            return;
          }
        }

        setIndexing(true, 1, "Fetching repository...");
        setCurrentStage(1);

        const data = await indexRepository(githubUrl, githubToken);

        // Detect on-demand mode
        const onDemandMode = data.indexMode === "on-demand";
        setIsOnDemand(onDemandMode);

        setFileCount(data.totalFiles);
        setCurrentStage(2);

        const repoData = {
          repoId: data.repoId,
          meta: data.meta,
          fileTree: data.fileTree,
          fileContents: data.fileContents,
          repoContext: data.repoContext,
          githubToken,
          // On-demand fields
          indexMode: data.indexMode || "full",
          totalSourceFiles: data.totalSourceFiles || data.totalFiles,
          unfetchedFiles: data.unfetchedFiles || [],
        };

        setRepoData(repoData as any);

        // Save to cache if enabled
        if (settings.cacheIndexData) {
          safeSetRepoCache(`repo_cache_${githubUrl}`, repoData);
        }

        // Fire off code chunk ingestion to Pinecone + Prisma (background)
        // This populates the search index for hybrid RAG in AI chat
        setIngestState("active");
        ingestCodeChunks(
          data.repoId,
          data.fileContents.map(f => ({ path: f.path, content: f.content })),
          {
            name: data.meta?.name,
            owner: data.meta?.owner,
            description: data.meta?.description,
            language: data.meta?.language,
            stars: data.meta?.stars,
            forks: data.meta?.forks,
          }
        )
          .then(res => {
            console.log(`[ingest] Ingested ${res.count} code chunks for ${data.repoId}`);
            setIngestState("done");
          })
          .catch(err => {
            console.error("[ingest] Code chunk ingestion failed:", err);
            setIngestState("error");
            toast({
              title: "Search indexing failed",
              description: "The repo indexed, but hybrid search/chat context won't be available. " + (err instanceof Error ? err.message : "Unknown error"),
              variant: "destructive",
            });
          });

        setCurrentStage(3);

        try {
          const overview = await generateOverview(data.repoContext);
          setOverview(overview as any);

          // Persist overview into the localStorage cache so refreshes keep it
          if (settings.cacheIndexData) {
            const cacheKey = `repo_cache_${githubUrl}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
              try {
                const cachedData = JSON.parse(cached);
                cachedData.overview = overview;
                safeSetRepoCache(cacheKey, cachedData);
              } catch { /* ignore */ }
            }
          }
          // Also persist with repo-specific key for direct navigation
          safeSetRepoCache(`repo_data_${data.repoId}`, { ...repoData, overview });
        } catch (e) {
          console.error("Overview generation failed:", e);
        }

        setDone(true);
        setIndexing(false);
        setTimeout(() => navigate(`/repo/${data.repoId}`), 1200);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to index repository");
        setIndexing(false);
        toast({ title: "Indexing failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
      }
    };

    doIndex();
  }, [githubUrl, githubToken, navigate, setRepoData, setOverview, setIndexing, settings.cacheIndexData]);

  const handleRetry = () => {
    if (newToken) {
      localStorage.setItem("github_pat", newToken);
      setGithubToken(newToken);
      setError(null);
      started.current = false; // Reset started ref to allow re-run
    }
  };

  const displayUrl = githubUrl
    ? githubUrl.replace("https://github.com/", "")
    : repoId === "custom-repo" ? "user/repo" : repoId;

  const stageStatus = (index: number): "complete" | "active" | "error" | "idle" => {
    if (done) return "complete";
    if (index === 0) return currentStage >= 2 ? "complete" : currentStage === 1 ? "active" : "idle";
    if (index === 1) {
      if (ingestState === "error") return "error";
      if (ingestState === "done") return "complete";
      return currentStage >= 2 ? "active" : "idle";
    }
    return currentStage >= 3 ? "active" : "idle";
  };

  const completedStages = STAGES.filter((_, i) => stageStatus(i) === "complete").length;
  const progressPct = done ? 100 : Math.round((completedStages / STAGES.length) * 100);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-sm w-full mx-6">
        <div className="mb-6">
          <p className="text-sm font-medium text-foreground mb-1">Indexing repository</p>
          <p className="text-xs font-mono text-muted-foreground truncate">{displayUrl}</p>
        </div>

        <div className="space-y-3 mb-6" role="status" aria-live="polite">
          {STAGES.map((stage, i) => {
            const status = stageStatus(i);

            return (
              <div key={stage.label} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 transition-colors ${
                  status === "complete" ? "bg-success/15 text-success"
                  : status === "active" ? "bg-primary/15 text-primary"
                  : status === "error" ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-muted-foreground"
                }`}>
                  {status === "complete" ? <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  : status === "active" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  : status === "error" ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  : <stage.icon className="h-3.5 w-3.5" aria-hidden="true" />}
                </div>
                <p className={`text-xs transition-colors ${
                  status === "complete" ? "text-success"
                  : status === "active" ? "text-foreground"
                  : status === "error" ? "text-destructive"
                  : "text-muted-foreground"
                }`}>
                  {stage.label}
                  {i === 1 && status === "error" && " — failed, continuing without search"}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>{fileCount > 0 ? `${fileCount.toLocaleString()} files` : "Reading repository…"}</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <motion.div className="h-full rounded-full bg-primary"
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.5 }} />
          </div>
        </div>

        {isOnDemand && (
          <motion.div 
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-xl border border-primary/20 bg-primary/5"
          >
            <p className="text-[11px] font-semibold text-primary mb-1">⚡ Large Repository Detected</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Indexing skeleton files only. {fileCount > 0 ? `${fileCount.toLocaleString()} files` : 'Remaining files'} available on-demand when you browse or ask the AI.
            </p>
          </motion.div>
        )}
        {error && (
          <div className="p-4 rounded-2xl border border-destructive/20 bg-destructive/5 flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive leading-relaxed">{error}</p>
            </div>
            
            {error.includes("private") && (
              <div className="space-y-3 pt-2 border-t border-destructive/10">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Provide Access Token</p>
                <input
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxx"
                  value={newToken}
                  onChange={(e) => setNewToken(e.target.value)}
                  className="w-full bg-background/50 border border-border rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-primary/40 transition-all"
                />
                <div className="flex gap-2">
                  <Button onClick={handleRetry} className="flex-1 h-8 text-[11px] bg-primary text-primary-foreground hover:bg-primary/90">
                    Retry Indexing
                  </Button>
                  <Button variant="ghost" onClick={() => navigate("/")} className="h-8 text-[11px] px-3">
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {!error.includes("private") && (
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="w-fit text-[11px] h-6 px-2">
                ← Back to Home
              </Button>
            )}
          </div>
        )}

        {done && (
          <p className="text-xs text-success">Done — redirecting...</p>
        )}

        {!done && !error && (
          <Button variant="ghost" onClick={() => navigate("/")} className="text-[11px] text-muted-foreground h-7 px-2">
            Cancel
          </Button>
        )}
      </motion.div>
    </div>
  );
};

export default IndexingProgress;
