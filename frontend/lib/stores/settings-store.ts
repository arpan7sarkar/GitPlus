"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Settings {
  reducedMotion: boolean;
  autoOpenGraph: boolean;
  compactMode: boolean;
  defaultAIProvider: "gemini" | "openai" | "anthropic";
  cacheIndexData: boolean;
  autoSaveChatHistory: boolean;
  strictHttps: boolean;
}

interface SettingsState {
  settings: Settings;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetDefaults: () => void;
}

const defaults: Settings = {
  reducedMotion: false,
  autoOpenGraph: false,
  compactMode: false,
  defaultAIProvider: "gemini",
  cacheIndexData: true,
  autoSaveChatHistory: true,
  strictHttps: true,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaults,
      setSetting: (key, value) =>
        set((state) => ({
          settings: { ...state.settings, [key]: value },
        })),
      resetDefaults: () => set({ settings: defaults }),
    }),
    { name: "gitplus-settings" }
  )
);
