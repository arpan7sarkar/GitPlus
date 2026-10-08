import { useCallback, useEffect, useRef, useState } from "react";
import { useUserAuth } from "@/hooks/use-user-auth";
import { useCompactMode } from "@/hooks/use-compact-mode";
import { fetchUserRepositories } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, GitBranch, Globe, Loader2, Lock, RefreshCw, Search, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  updated_at: string;
  stargazers_count: number;
  language: string | null;
}

interface UserReposProps {
  onIndex: (repoUrl: string) => void;
}

interface RepositoryListState {
  userId: string | null;
  repos: Repository[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
}

export function UserRepos({ onIndex }: UserReposProps) {
  const { user } = useUserAuth();
  const userId = user?.id ?? null;
  const compact = useCompactMode();
  const requestGeneration = useRef(0);
  const [search, setSearch] = useState("");
  const [list, setList] = useState<RepositoryListState>({
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
      const repos = await fetchUserRepositories();
      if (generation !== requestGeneration.current) return;
      setList({ userId, repos, loading: false, refreshing: false, error: null });
    } catch (error) {
      if (generation !== requestGeneration.current) return;
      setList((previous) => ({
        ...previous,
        loading: false,
        refreshing: false,
        error: error instanceof Error ? error.message : "Could not load repositories from GitHub.",
      }));
    }
  }, [userId]);

  useEffect(() => {
    setSearch("");
    void loadRepos();
    return () => { requestGeneration.current += 1; };
  }, [loadRepos]);

  if (!userId) return null;

  const loading = list.userId !== userId || list.loading;
  const query = search.trim().toLowerCase();
  const filteredRepos = list.repos.filter((repo) =>
    repo.full_name.toLowerCase().includes(query) ||
    (repo.description?.toLowerCase().includes(query) ?? false)
  );

  return (
    <section aria-labelledby="github-repositories-title" className={cn("space-y-4", compact ? "py-4" : "py-6")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="github-repositories-title" className="text-lg font-semibold">Your GitHub repositories</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a repository to analyze, or paste a URL above.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void loadRepos(true)}
          disabled={loading || list.refreshing}
          className="min-h-11 gap-2 self-start sm:min-h-9"
        >
          <RefreshCw className={cn("h-4 w-4", list.refreshing && "animate-spin")} aria-hidden="true" />
          {list.refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {loading ? (
        <div role="status" className="flex items-center gap-3 rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading repositories from GitHub…
        </div>
      ) : (
        <>
          {list.error && (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-medium">Couldn’t {list.repos.length ? "refresh" : "load"} your GitHub repositories.</p>
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
                  <label htmlFor="github-repository-filter" className="mb-1.5 block text-sm font-medium">Filter repositories</label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="github-repository-filter"
                      placeholder="Owner, name, or description"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="min-h-11 pl-9 text-sm sm:min-h-9"
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground" role="status">
                  {filteredRepos.length} of {list.repos.length} loaded repositories
                </p>
              </div>

              {filteredRepos.length ? (
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                  {filteredRepos.map((repo) => (
                    <li key={repo.id} className={cn("flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between", compact ? "py-3" : "py-4")}>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <h3 className="min-w-0 break-words font-mono text-sm font-medium">{repo.full_name}</h3>
                          <span className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                            {repo.private ? <Lock className="h-3 w-3" aria-hidden="true" /> : <Globe className="h-3 w-3" aria-hidden="true" />}
                            {repo.private ? "Private" : "Public"}
                          </span>
                        </div>
                        {repo.description && <p className="mt-1.5 break-words text-sm leading-relaxed text-muted-foreground">{repo.description}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {repo.language && <span>{repo.language}</span>}
                          <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5" aria-hidden="true" /> {repo.stargazers_count.toLocaleString()} stars</span>
                          <span>Updated <time dateTime={repo.updated_at}>{new Date(repo.updated_at).toLocaleDateString()}</time></span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button variant="outline" asChild className="min-h-11 gap-2 sm:min-h-9">
                          <a href={repo.html_url} target="_blank" rel="noopener noreferrer" aria-label={`View ${repo.full_name} on GitHub`}>
                            <ExternalLink className="h-4 w-4" aria-hidden="true" /> GitHub
                          </a>
                        </Button>
                        <Button onClick={() => onIndex(repo.html_url)} className="min-h-11 sm:min-h-9" aria-label={`Analyze ${repo.full_name}`}>
                          Analyze
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-5 text-sm">
                  <p className="font-medium">No repositories match this filter.</p>
                  <p className="mt-1 text-muted-foreground">Try another owner, name, or description.</p>
                  <Button variant="outline" onClick={() => setSearch("")} className="mt-3 min-h-11 sm:min-h-9">Clear filter</Button>
                </div>
              )}
            </>
          )}

          {!list.error && list.repos.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-5 text-sm">
              <p className="font-medium">GitHub returned no repositories.</p>
              <p className="mt-1 text-muted-foreground">You can still paste a public repository URL above, or refresh the list.</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
