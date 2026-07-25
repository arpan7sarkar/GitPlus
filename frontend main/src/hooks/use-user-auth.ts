/**
 * User Auth Hook — Stub implementation.
 * 
 * Previously backed by Supabase Auth. Currently a no-op stub since
 * the backend uses Clerk auth and the frontend auth integration is TBD.
 * All consumers of this hook will see the user as "not logged in" (guest mode).
 * 
 * To enable auth later, replace this with Clerk's React SDK or re-enable Supabase.
 */

import { useState } from "react";

interface UserLike {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

interface SessionLike {
  provider_token?: string;
  access_token?: string;
}

export const useUserAuth = () => {
  const [user] = useState<UserLike | null>(null);
  const [session] = useState<SessionLike | null>(null);
  const [loading] = useState(false);

  const loginWithGitHub = async () => {
    console.warn("[auth] GitHub login is not connected. Auth integration is TBD.");
    return { error: new Error("Auth not configured") };
  };

  const logout = async () => {
    console.warn("[auth] Logout is a no-op. Auth integration is TBD.");
    return { error: null };
  };

  const fetchUserRepos = async () => {
    // Without a GitHub token from auth, we can't fetch user repos
    return [];
  };

  return {
    user,
    session,
    loading,
    loginWithGitHub,
    logout,
    fetchUserRepos,
  };
};
