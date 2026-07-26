import { create } from "zustand";
import { fetchCurrentUser, logoutUser, type AuthUser, type AuthSession } from "@/lib/api";

interface AuthStore {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  initialized: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  session: null,
  loading: true,
  initialized: false,

  refresh: async () => {
    set({ loading: true });
    try {
      const result = await fetchCurrentUser();
      set({ user: result?.user ?? null, session: result?.session ?? null, loading: false, initialized: true });
    } catch (e) {
      console.error("[auth] Failed to fetch current user:", e);
      set({ user: null, session: null, loading: false, initialized: true });
    }
  },

  logout: async () => {
    try {
      await logoutUser();
    } catch (e) {
      console.error("[auth] Logout request failed:", e);
    }
    set({ user: null, session: null });
  },
}));
