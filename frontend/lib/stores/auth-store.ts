"use client";

import { create } from "zustand";

interface MockUser {
  id: string;
  email: string;
  name: string;
  username: string;
  avatarUrl: string;
  createdAt: string;
}

const MOCK_USER: MockUser = {
  id: "usr_demo123",
  email: "dev@codebasegpt.com",
  name: "Demo Developer",
  username: "demodev",
  avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
  createdAt: new Date(Date.now() - 180 * 86400000).toISOString(),
};

interface AuthState {
  isAuthed: boolean;
  user: MockUser | null;
  login: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthed: false,
  user: null,
  login: () => set({ isAuthed: true, user: MOCK_USER }),
  logout: () => set({ isAuthed: false, user: null }),
}));
