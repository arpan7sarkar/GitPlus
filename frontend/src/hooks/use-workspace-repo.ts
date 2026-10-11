import { useEffect, useMemo } from "react";
import { useRepoStore } from "@/lib/store";
import { readRouteRepositoryCache } from "@/lib/repo-cache";

export function useWorkspaceRepo(routeId: string | undefined) {
  const state = useRepoStore();
  const cached = useMemo(() => routeId && routeId !== state.repoId ? readRouteRepositoryCache(routeId) : null, [routeId, state.repoId]);
  const matches = Boolean(routeId && state.meta && (
    routeId === state.repoId || (cached?.repoId === state.repoId &&
      cached.meta.owner === state.meta.owner && cached.meta.name === state.meta.name)
  ));

  useEffect(() => {
    if (matches || !cached) return;
    state.setRepoData(cached);
    if (cached.overview) state.setOverview(cached.overview);
  }, [matches, cached, state.setRepoData, state.setOverview]);

  return matches ? state : {
    ...state,
    repoId: null,
    meta: null,
    overview: null,
    fileTree: [],
    fileContents: [],
    repoContext: "",
    githubToken: null,
    unfetchedFiles: [],
    totalSourceFiles: 0,
    indexMode: "full" as const,
    isIndexing: false,
    indexingStage: 0,
    indexingMessage: "",
    searchIndex: { status: "unknown" as const },
    openedFiles: [],
    activeFilePath: null,
    dirtyFiles: new Set<string>(),
    terminalLogs: [],
  };
}
