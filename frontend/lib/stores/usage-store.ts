"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

const FREE_LIMIT = 5;

interface UsageState {
  indexCount: number;
  incrementIndex: () => void;
  canIndex: (isAuthed: boolean) => boolean;
  resetUsage: () => void;
}

export const useUsageStore = create<UsageState>()(
  persist(
    (set, get) => ({
      indexCount: 0,
      incrementIndex: () => set((s) => ({ indexCount: s.indexCount + 1 })),
      canIndex: (isAuthed: boolean) => isAuthed || get().indexCount < FREE_LIMIT,
      resetUsage: () => set({ indexCount: 0 }),
    }),
    { name: "gitplus-usage" }
  )
);
