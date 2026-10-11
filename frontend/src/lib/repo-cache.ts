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
