/**
 * User Auth Hook — backed by GitHub OAuth (server-side session, see server/src/routes/auth.ts).
 *
 * State lives in `useAuthStore` (zustand) so every component sees the same
 * signed-in/out state without re-fetching independently. `loginWithGitHub` does a
 * full-page redirect to GitHub's consent screen; on return, the server has already
 * set the session cookie, so `refresh()` picks up the signed-in user.
 */

import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { githubLoginUrl, fetchUserRepositories } from "@/lib/api";

export const useUserAuth = () => {
  const { user, session, loading, initialized, refresh, logout } = useAuthStore();

  useEffect(() => {
    if (!initialized) refresh();
  }, [initialized, refresh]);

  const loginWithGitHub = async () => {
    window.location.href = githubLoginUrl();
    return { error: null };
  };

  const handleLogout = async () => {
    await logout();
    return { error: null };
  };

  const fetchUserRepos = async () => {
    if (!user) return [];
    try {
      return await fetchUserRepositories();
    } catch (e) {
      console.error("[auth] Failed to fetch user repos:", e);
      return [];
    }
  };

  return {
    user,
    session,
    loading,
    loginWithGitHub,
    logout: handleLogout,
    fetchUserRepos,
  };
};
