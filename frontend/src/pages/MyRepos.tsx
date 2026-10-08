import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, FolderGit2, GitFork, Loader2, RefreshCw, Search, Star } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUserAuth } from "@/hooks/use-user-auth";
import { useCompactMode } from "@/hooks/use-compact-mode";
import { fetchIndexedRepos, type IndexedRepoEntry } from "@/lib/api";
import { LoginDialog } from "@/components/auth/LoginDialog";
import { cn } from "@/lib/utils";

interface IndexedRepositoryListState {
  userId: string | null;
  repos: IndexedRepoEntry[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
}

const MyRepos = () => {
  const { user, loading: authLoading } = useUserAuth();
  const userId = user?.id ?? null;
  const navigate = useNavigate();
  const compact = useCompactMode();
  const requestGeneration = useRef(0);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [filter, setFilter] = useState("");
  const [list, setList] = useState<IndexedRepositoryListState>({
    userId: null, repos: [], loading: false, refreshing: false, error: null,
  });

  const loadRepos = useCallback(async (isRefresh = false) => {
    if (!userId) return;
    const generation = ++requestGeneration.current;
    setList((previous) => ({
      userId,
      repos: previous.userId === userId ? previous.repos : [],
      loading: !isRefresh || previous.userId !== userId,
      refreshing: isRefresh,
      error: null,
    }));

    try {
      const repos = await fetchIndexedRepos();
      if (generation !== requestGeneration.current) return;
      setList({ userId, repos, loading: false, refreshing: false, error: null });
    } catch (error) {
      if (generation !== requestGeneration.current) return;
      setList((previous) => ({
        ...previous,
        loading: false,
        refreshing: false,
        error: error instanceof Error ? error.message : "Could not load your saved repositories.",
      }));
    }
  }, [userId]);

  useEffect(() => {
    setFilter("");
    void loadRepos();
    return () => { requestGeneration.current += 1; };
  }, [loadRepos]);

  const loading = authLoading || (userId !== null && (list.userId !== userId || list.loading));
  const query = filter.trim().toLowerCase();
  const filteredRepos = list.repos.filter((repo) =>
    `${repo.owner}/${repo.name}`.toLowerCase().includes(query) ||
    (repo.description?.toLowerCase().includes(query) ?? false)
  );
  const workspaceSearch = compact ? "?mode=compact" : "";

  return (
    <PageLayout title="My Repos" subtitle="Previously indexed repositories linked to your account." category="Workspace">
      {loading ? (
        <div role="status" className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {authLoading ? "Checking your session…" : "Loading your saved repositories…"}
        </div>
      ) : !user ? (
        <div className="space-y-3 py-4">
          <FolderGit2 className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Sign in to return to your repositories</h2>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">Your saved repository list is linked to your GitHub account.</p>
          <Button onClick={() => setShowLoginDialog(true)} className="min-h-11 sm:min-h-9">Sign in with GitHub</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Open a repository overview to continue exploring its code.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => void loadRepos(true)} disabled={list.refreshing} className="min-h-11 gap-2 sm:min-h-9">
                <RefreshCw className={cn("h-4 w-4", list.refreshing && "animate-spin")} aria-hidden="true" />
                {list.refreshing ? "Refreshing…" : "Refresh"}
              </Button>
              <Button onClick={() => navigate(`/${workspaceSearch}`)} className="min-h-11 sm:min-h-9">Analyze a repository</Button>
            </div>
          </div>

          {list.error && (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-medium">Couldn’t {list.repos.length ? "refresh" : "load"} your saved repositories.</p>
              <p className="mt-1 break-words text-sm text-muted-foreground">{list.error}</p>
              {list.repos.length > 0 && <p className="mt-1 text-sm text-muted-foreground">Showing the last loaded list.</p>}
              <Button variant="outline" onClick={() => void loadRepos(true)} disabled={list.refreshing} className="mt-3 min-h-11 gap-2 sm:min-h-9">
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
              </Button>
            </div>
          )}

          {list.repos.length > 0 && (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div className="w-full sm:max-w-sm">
                  <label htmlFor="saved-repository-filter" className="mb-1.5 block text-sm font-medium">Filter saved repositories</label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input id="saved-repository-filter" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Owner, name, or description" className="min-h-11 pl-9 text-sm sm:min-h-9" />
                  </div>
                </div>
                <p role="status" className="text-sm text-muted-foreground">{filteredRepos.length} of {list.repos.length} saved repositories</p>
              </div>

              {filteredRepos.length ? (
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                  {filteredRepos.map((repo) => (
                    <li key={repo.id} className={cn("flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between", compact ? "py-3" : "py-4")}>
                      <div className="min-w-0 flex-1">
                        <h2 className="break-words font-mono text-sm font-medium">{repo.owner}/{repo.name}</h2>
                        {repo.description && <p className="mt-1.5 break-words text-sm leading-relaxed text-muted-foreground">{repo.description}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {repo.language && <span>{repo.language}</span>}
                          {repo.stars !== null && <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5" aria-hidden="true" /> {repo.stars.toLocaleString()} stars</span>}
                          {repo.forks !== null && <span className="inline-flex items-center gap-1"><GitFork className="h-3.5 w-3.5" aria-hidden="true" /> {repo.forks.toLocaleString()} forks</span>}
                          <span>Indexed <time dateTime={repo.lastIndexedAt}>{new Date(repo.lastIndexedAt).toLocaleDateString()}</time></span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button variant="outline" asChild className="min-h-11 gap-2 sm:min-h-9">
                          <a href={`https://github.com/${repo.owner}/${repo.name}`} target="_blank" rel="noopener noreferrer" aria-label={`View ${repo.owner}/${repo.name} on GitHub`}>
                            <ExternalLink className="h-4 w-4" aria-hidden="true" /> GitHub
                          </a>
                        </Button>
                        <Button onClick={() => navigate(`/repo/${repo.repoId}${workspaceSearch}`)} className="min-h-11 sm:min-h-9" aria-label={`Open ${repo.owner}/${repo.name}`}>
                          Open overview
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-5 text-sm">
                  <p className="font-medium">No saved repositories match this filter.</p>
                  <p className="mt-1 text-muted-foreground">Try another owner, name, or description.</p>
                  <Button variant="outline" onClick={() => setFilter("")} className="mt-3 min-h-11 sm:min-h-9">Clear filter</Button>
                </div>
              )}
            </>
          )}

          {!list.error && list.repos.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-5 text-sm">
              <p className="font-medium">No indexed repositories are linked to this account yet.</p>
              <p className="mt-1 text-muted-foreground">Analyze a repository from the homepage, then refresh this list after indexing finishes.</p>
              <Button onClick={() => navigate(`/${workspaceSearch}`)} className="mt-3 min-h-11 sm:min-h-9">Analyze a repository</Button>
            </div>
          )}
        </div>
      )}
      <LoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} />
    </PageLayout>
  );
};

export default MyRepos;
