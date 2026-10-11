import type { RepoMeta } from "@/lib/mock-data";
import type { OverviewData } from "@/types/backend";
import type { useRepoStore } from "@/lib/store";

export type RepositoryData = Parameters<ReturnType<typeof useRepoStore.getState>["setRepoData"]>[0];
export type CachedRepository = RepositoryData & { overview?: OverviewData };

function validTree(nodes: unknown): boolean {
  return Array.isArray(nodes) && nodes.every((node) => node && typeof node.name === "string" &&
    typeof node.path === "string" && ["file", "folder"].includes(node.type) &&
    (node.children === undefined || validTree(node.children)));
}

function validOverview(overview: unknown): overview is OverviewData {
  if (!overview || typeof overview !== "object") return false;
  const value = overview as Record<string, unknown>;
  return typeof value.narrative === "string" && typeof value.framework === "string" &&
    typeof value.complexity === "string" && ["keyFiles", "mainDeps", "suggestedQs", "keyPatterns"].every((key) =>
      Array.isArray(value[key]) && (value[key] as unknown[]).every((item) => typeof item === "string")
    ) && Array.isArray(value.languages) && value.languages.every((language) =>
      typeof language === "string" || (language && typeof language.name === "string" && Number.isFinite(language.percentage))
    );
}

export function readRepositoryCache(key: string): CachedRepository | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.repoId !== "string" || !data.repoId || !data.meta ||
        typeof data.meta.id !== "string" || typeof data.meta.owner !== "string" || typeof data.meta.name !== "string" ||
        typeof data.meta.language !== "string" || typeof data.meta.description !== "string" ||
        typeof data.meta.framework !== "string" || !["Low", "Medium", "High", "Enterprise"].includes(data.meta.complexity) ||
        !Number.isFinite(data.meta.fileCount) || data.meta.fileCount < 0 || !Number.isFinite(data.meta.stars) || data.meta.stars < 0 ||
        !validTree(data.fileTree) || !Array.isArray(data.fileContents) ||
        data.fileContents.some((file: { path?: unknown; content?: unknown; size?: unknown } | null) =>
          !file || typeof file.path !== "string" || typeof file.content !== "string" || !Number.isFinite(file.size)) ||
        typeof data.repoContext !== "string" ||
        (data.githubToken !== undefined && typeof data.githubToken !== "string") ||
        (data.indexMode !== undefined && !["full", "on-demand"].includes(data.indexMode)) ||
        (data.totalSourceFiles !== undefined && (!Number.isFinite(data.totalSourceFiles) || data.totalSourceFiles < 0)) ||
        (data.unfetchedFiles !== undefined && (!Array.isArray(data.unfetchedFiles) ||
          data.unfetchedFiles.some((file: { path?: unknown; size?: unknown } | null) => !file || typeof file.path !== "string" || !Number.isFinite(file.size))))) return null;
    return { ...data, overview: validOverview(data.overview) ? data.overview : undefined };
  } catch {
    return null;
  }
}

function identifierMatchesMeta(id: string, meta: RepoMeta): boolean {
  const prefix = `gh-${meta.owner}-${meta.name}-`;
  return id.startsWith(prefix) && /^[a-z0-9]+$/.test(id.slice(prefix.length));
}

export function readRouteRepositoryCache(routeId: string): CachedRepository | null {
  const data = readRepositoryCache(`repo_data_${routeId}`);
  if (!data) return null;
  if (routeId.startsWith("gh-")) {
    return identifierMatchesMeta(routeId, data.meta) && identifierMatchesMeta(data.repoId, data.meta) ? data : null;
  }
  return routeId === data.repoId && data.meta.id === routeId ? data : null;
}

export function matchesWorkspaceRepository(routeId: string | undefined, repoId: string | null, meta: RepoMeta | null): boolean {
  if (!routeId || !repoId || !meta) return false;
  if (routeId === repoId) return true;
  const cached = readRouteRepositoryCache(routeId);
  return cached?.repoId === repoId && cached.meta.owner === meta.owner && cached.meta.name === meta.name;
}

/**
 * Safe localStorage cache for repo data (repo_cache_*, repo_data_*).
 * These blobs are pure performance cache — full file contents + context for
 * every repo ever indexed, with no eviction, so localStorage's ~5-10MB per-origin
 * quota eventually fills up and a raw setItem() throws QuotaExceededError.
 * That's uncaught in the callers, so it silently aborts whatever ran after it in
 * the same block (e.g. skipping the search-index ingest call).
 *
 * Since this is disposable cache (worst case on a miss: refetch from GitHub /
 * regenerate the AI overview), the safe response to quota pressure is to evict
 * every previous repo cache entry and retry once — never let a caching failure
 * break the actual feature.
 */

function evictAllRepoCache(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith("repo_cache_") || key.startsWith("repo_data_"))) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) localStorage.removeItem(key);
}

/**
 * Best-effort cache write. Never throws — on quota pressure it evicts all prior
 * repo cache entries and retries once; if it still fails, it just logs and moves on.
 */
export function safeSetRepoCache(key: string, value: unknown): void {
  const serialized = JSON.stringify(value);
  try {
    localStorage.setItem(key, serialized);
  } catch (e) {
    console.warn(`[repo-cache] setItem("${key}") failed (likely quota), evicting old repo cache and retrying:`, e);
    try {
      evictAllRepoCache();
      localStorage.setItem(key, serialized);
    } catch (e2) {
      console.warn(`[repo-cache] setItem("${key}") still failed after eviction, giving up on caching this repo:`, e2);
    }
  }
}
