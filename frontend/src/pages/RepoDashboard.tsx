import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowUpRight, Code2, FileCode, GitBranch, Layers, Loader2, MessageSquare, Network, Package, RefreshCw, Sparkles, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRepoStore } from "@/lib/store";
import { useWorkspaceRepo } from "@/hooks/use-workspace-repo";
import { useUserAuth } from "@/hooks/use-user-auth";
import { useCompactMode } from "@/hooks/use-compact-mode";
import WorkspaceNav from "@/components/layout/WorkspaceNav";
import NoRepoLoaded from "@/components/layout/NoRepoLoaded";
import DependencyGraph from "@/components/dashboard/DependencyGraph";
import CodebaseSearch from "@/components/dashboard/CodebaseSearch";
import { openInStackBlitz } from "@/lib/webcontainer";
import { fetchIndexedRepos, generateOverview, indexRepository, ingestCodeChunks } from "@/lib/api";
import { matchesWorkspaceRepository, readRouteRepositoryCache, safeSetRepoCache, type RepositoryData } from "@/lib/repo-cache";

const RepoDashboard = () => {
  const { repoId } = useParams();
  const navigate = useNavigate();
  const compact = useCompactMode();
  const { user, session, loading: authLoading } = useUserAuth();
  const workspace = useWorkspaceRepo(repoId);
  const { meta: repo, overview, fileTree, fileContents, repoContext, indexMode, totalSourceFiles, unfetchedFiles, setRepoData, setOverview, setSearchIndex, searchIndex } = workspace;
  const [graphExpanded, setGraphExpanded] = useState(false);
  const [loadState, setLoadState] = useState<{ route?: string; loading: boolean; message: string; error: string | null }>({ loading: false, message: "", error: null });
  const [overviewState, setOverviewState] = useState<{ id: string | null; loading: boolean; error: string | null }>({ id: null, loading: false, error: null });
  const [retryCount, setRetryCount] = useState(0);
  const [overviewRetry, setOverviewRetry] = useState(0);
  const loadGeneration = useRef(0);
  const overviewGeneration = useRef(0);
  const routeRef = useRef(repoId);
  routeRef.current = repoId;
  const workspaceSearch = compact ? "?mode=compact" : "";
  const chatRoute = `/repo/${repoId}/chat${workspaceSearch}`;

  useEffect(() => {
    if (!repoId || authLoading) return;
    const current = useRepoStore.getState();
    if (matchesWorkspaceRepository(repoId, current.repoId, current.meta) || readRouteRepositoryCache(repoId)) return;
    const generation = ++loadGeneration.current;
    let active = true;
    const ownsRequest = () => active && generation === loadGeneration.current && routeRef.current === repoId;
    setLoadState({ route: repoId, loading: Boolean(user), message: "Loading repository details…", error: null });
    if (user) {
      void (async () => {
        try {
          const repos = await fetchIndexedRepos();
          if (!ownsRequest()) return;
          const saved = repos.find((entry) => entry.repoId === repoId);
          if (!saved) {
            setLoadState({ route: repoId, loading: false, message: "", error: null });
            return;
          }
          const token = localStorage.getItem("github_pat") || session?.provider_token || undefined;
          setLoadState({ route: repoId, loading: true, message: `Fetching ${saved.owner}/${saved.name} from GitHub…`, error: null });
          const data = await indexRepository(`https://github.com/${saved.owner}/${saved.name}`, token);
          if (!ownsRequest()) return;
          const repoData: RepositoryData = {
            repoId: data.repoId,
            meta: data.meta,
            fileTree: data.fileTree,
            fileContents: data.fileContents,
            repoContext: data.repoContext,
            githubToken: token,
            indexMode: data.indexMode || "full",
            totalSourceFiles: data.totalSourceFiles ?? data.totalFiles,
            unfetchedFiles: data.unfetchedFiles || [],
          };
          safeSetRepoCache(`repo_data_${repoId}`, repoData);
          safeSetRepoCache(`repo_data_${data.repoId}`, repoData);
          setRepoData(repoData);
          setLoadState({ route: repoId, loading: false, message: "", error: null });
          setSearchIndex(data.repoId, "pending");
          void ingestCodeChunks(data.repoId, data.fileContents.map(({ path, content }) => ({ path, content })), {
            name: data.meta.name, owner: data.meta.owner, description: data.meta.description, language: data.meta.language, stars: data.meta.stars,
          }).then((result) => {
            if (ownsRequest()) setSearchIndex(data.repoId, result.count > 0 ? "ready" : "empty", undefined, result.count);
          }).catch((error) => {
            if (ownsRequest()) setSearchIndex(data.repoId, "error", error instanceof Error ? error.message : "Search indexing failed.");
          });
        } catch (error) {
          if (ownsRequest()) setLoadState({ route: repoId, loading: false, message: "", error: error instanceof Error ? error.message : "Could not load this repository." });
        }
      })();
    }
    return () => { active = false; };
  }, [repoId, authLoading, user?.id, session?.provider_token, retryCount, setRepoData, setSearchIndex]);

  useEffect(() => {
    const id = workspace.repoId;
    if (!id || !repoContext || overview) return;
    const generation = ++overviewGeneration.current;
    let active = true;
    const ownsRequest = () => active && generation === overviewGeneration.current && routeRef.current === repoId && useRepoStore.getState().repoId === id;
    setOverviewState({ id, loading: true, error: null });
    void generateOverview(repoContext).then((generated) => {
      if (!ownsRequest()) return;
      setOverviewState({ id, loading: false, error: null });
      setOverview(generated as Parameters<typeof setOverview>[0]);
      const current = useRepoStore.getState();
      const data: RepositoryData = {
        repoId: id, meta: current.meta!, fileTree: current.fileTree, fileContents: current.fileContents,
        repoContext: current.repoContext, githubToken: current.githubToken || undefined,
        indexMode: current.indexMode, totalSourceFiles: current.totalSourceFiles, unfetchedFiles: current.unfetchedFiles,
      };
      safeSetRepoCache(`repo_data_${id}`, { ...data, overview: generated });
      if (repoId) safeSetRepoCache(`repo_data_${repoId}`, { ...data, overview: generated });
    }).catch((error) => {
      if (ownsRequest()) setOverviewState({ id, loading: false, error: error instanceof Error ? error.message : "Could not generate an overview." });
    });
    return () => { active = false; };
  }, [workspace.repoId, repoId, repoContext, overview, overviewRetry, setOverview]);

  const loading = loadState.route === repoId && loadState.loading;
  const loadError = loadState.route === repoId ? loadState.error : null;
  const overviewLoading = overviewState.id === workspace.repoId && overviewState.loading;
  const overviewError = overviewState.id === workspace.repoId ? overviewState.error : null;
  const askQuestion = (initialQuestion: string) => navigate(chatRoute, { state: { initialQuestion } });
  const keyFiles = overview?.keyFiles || [];
  const dependencies = overview?.mainDeps || [];
  const questions = overview?.suggestedQs || [];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <WorkspaceNav repoId={repoId ?? ""} owner={repo?.owner} name={repo?.name} active="dashboard"
        actions={repo ? <CodebaseSearch repoId={repoId ?? repo.id} /> : undefined} />
      {!repo ? (
        loading || authLoading ? (
          <main id="main-content" tabIndex={-1} className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-10 sm:px-6" role="status">
            <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
            <p>{authLoading ? "Checking your session…" : loadState.message}</p>
          </main>
        ) : loadError ? (
          <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-2xl space-y-4 px-4 py-8 sm:px-6">
            <h1 className="text-2xl font-semibold">Couldn’t load this repository</h1>
            <p role="alert" className="break-words text-sm text-destructive">{loadError}</p>
            <p className="text-sm text-muted-foreground">For private repositories, reconnect from the homepage with GitHub access or a personal access token.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setRetryCount((count) => count + 1)}>Try again</Button>
              <Button onClick={() => navigate(`/${workspaceSearch}`)}>Connect a repository</Button>
            </div>
          </main>
        ) : <NoRepoLoaded repoId={repoId} />
      ) : (
        <main id="main-content" tabIndex={-1} className={`mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 sm:px-6 ${compact ? "py-5" : "py-8"}`}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="break-words text-2xl font-semibold">{repo.name}</h1>
                {repo.description && <p className="mt-2 max-w-3xl break-words text-sm leading-relaxed text-muted-foreground">{repo.description}</p>}
              </div>
              <Button variant="outline" onClick={() => openInStackBlitz(repo.name, fileContents)} disabled={!fileContents.length} className="min-h-10 gap-2">
                <Terminal className="h-4 w-4" aria-hidden="true" /> Open in IDE
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 text-sm">
              <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"><FileCode className="h-4 w-4 text-muted-foreground" aria-hidden="true" />{fileContents.length.toLocaleString()} loaded files</span>
              {repo.language && <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"><Code2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />{repo.language}</span>}
              {(overview?.framework || repo.framework) && <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"><Layers className="h-4 w-4 text-muted-foreground" aria-hidden="true" />{overview?.framework || repo.framework}</span>}
              {overview?.complexity && <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"><AlertTriangle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />AI complexity estimate: {overview.complexity}</span>}
            </div>

            {indexMode === "on-demand" && (
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <h2 className="font-medium">On-demand repository access</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{totalSourceFiles.toLocaleString()} source files were identified; {unfetchedFiles.length.toLocaleString()} have not been loaded. Open a file to fetch its content. Questions can only verify source that is available to the model.</p>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section className="min-w-0 rounded-lg border border-border bg-card p-5" aria-labelledby="architecture-heading">
                <h2 id="architecture-heading" className="flex items-center gap-2 text-base font-semibold"><Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />Architecture overview</h2>
                <p className="mb-4 mt-1 text-sm text-muted-foreground">AI-generated notes. Verify claims against the source.</p>
                {overviewLoading ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Generating overview…</p> : overviewError ? (
                  <div className="space-y-3"><p role="alert" className="break-words text-sm text-destructive">{overviewError}</p><Button variant="outline" onClick={() => setOverviewRetry((count) => count + 1)} className="min-h-10 gap-2"><RefreshCw className="h-4 w-4" aria-hidden="true" />Retry overview</Button></div>
                ) : overview?.narrative ? <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{overview.narrative}</p> : <p className="text-sm text-muted-foreground">No overview is available. Loaded files and GitHub activity remain accessible.</p>}
              </section>
              <section className="min-w-0 rounded-lg border border-border bg-card p-5" aria-labelledby="key-files-heading">
                <h2 id="key-files-heading" className="flex items-center gap-2 text-base font-semibold"><FileCode className="h-4 w-4 text-primary" aria-hidden="true" />Key files</h2>
                <p className="mb-3 mt-1 text-sm text-muted-foreground">Selected by the overview model.</p>
                {keyFiles.length ? <ul className="space-y-1">{keyFiles.map((path) => <li key={path}><button className="min-h-10 w-full break-all rounded-md px-2 py-2 text-left font-mono text-sm hover:bg-muted" onClick={() => askQuestion(`Explain the file: ${path}`)}>{path}</button></li>)}</ul> : <p className="text-sm text-muted-foreground">{overviewLoading ? "Waiting for the overview…" : "No key files were suggested."}</p>}
              </section>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section className="min-w-0 rounded-lg border border-border bg-card p-4 sm:p-5" aria-labelledby="file-structure-heading">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id="file-structure-heading" className="flex items-center gap-2 text-base font-semibold"><Network className="h-4 w-4 text-primary" aria-hidden="true" />File structure</h2>
                  <Button variant="ghost" onClick={() => setGraphExpanded((expanded) => !expanded)} aria-expanded={graphExpanded} className="min-h-10">{graphExpanded ? "Collapse graph" : "Expand graph"}</Button>
                </div>
                <p className="mb-3 text-sm text-muted-foreground">Folder-to-file relationships, not an import dependency map.</p>
                <div style={{ height: graphExpanded ? 560 : compact ? 320 : 380 }}>
                  <DependencyGraph key={workspace.repoId} fileTree={fileTree} expanded={graphExpanded}
                    onShowDetails={(path) => askQuestion(`Show me the details of: ${path} — what does it do, what are its exports, and how is it used?`)}
                    onExplain={(path) => askQuestion(`Explain the file: ${path}`)} />
                </div>
              </section>
              <section className="min-w-0 rounded-lg border border-border bg-card p-5" aria-labelledby="dependencies-heading">
                <h2 id="dependencies-heading" className="flex items-center gap-2 text-base font-semibold"><Package className="h-4 w-4 text-primary" aria-hidden="true" />Dependencies</h2>
                <p className="mb-3 mt-1 text-sm text-muted-foreground">Reported by the overview model.</p>
                {dependencies.length ? <ul className="flex flex-wrap gap-2">{dependencies.map((dependency) => <li key={dependency} className="break-all rounded-md border border-border bg-muted px-2.5 py-1.5 font-mono text-sm">{dependency}</li>)}</ul> : <p className="text-sm text-muted-foreground">{overviewLoading ? "Waiting for the overview…" : "No dependencies were listed. Check the repository manifests."}</p>}
              </section>
            </div>

            <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="questions-heading">
              <h2 id="questions-heading" className="flex items-center gap-2 text-base font-semibold"><MessageSquare className="h-4 w-4 text-primary" aria-hidden="true" />Questions to explore</h2>
              {questions.length ? <ul className="mt-3 grid gap-2 sm:grid-cols-2">{questions.map((question) => <li key={question}><button onClick={() => askQuestion(question)} className="min-h-11 w-full rounded-md border border-border p-3 text-left text-sm leading-relaxed hover:bg-muted">{question}</button></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No questions were suggested. Start a chat about a file or architecture decision.</p>}
              <Button onClick={() => navigate(chatRoute)} className="mt-3 min-h-10 gap-2">Open chat & files<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Button>
            </section>

            <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-5" aria-labelledby="review-heading">
              <div className="min-w-0"><h2 id="review-heading" className="flex items-center gap-2 text-base font-semibold"><GitBranch className="h-4 w-4 text-primary" aria-hidden="true" />VexReview pull-request reviews</h2><p className="mt-1 text-sm text-muted-foreground">Review controls require GitHub sign-in and repository write access. Reviews may post comments to GitHub.</p></div>
              <Button variant="outline" onClick={() => navigate(`/repo/${repoId}/prs${workspaceSearch}`)} className="min-h-10 gap-2">Open pull requests<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Button>
            </section>
            <p role="status" className={`break-words text-sm ${searchIndex.status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
              {searchIndex.status === "pending" ? "Search ingestion is still running. File browsing is available." : searchIndex.status === "ready" ? `Search ingestion returned ${searchIndex.count ?? 0} chunks; vector availability may take time.` : searchIndex.status === "empty" ? "Search ingestion returned no chunks. File browsing is available." : searchIndex.status === "error" ? `Search indexing failed: ${searchIndex.message || "Try indexing again from the homepage."}` : "Repository data is loaded. Search-index readiness has not been checked."}
            </p>
          </motion.div>
        </main>
      )}
    </div>
  );
};

export default RepoDashboard;
