"use client";

import { create } from "zustand";

interface HealthState {
  status: "healthy" | "degraded" | "down" | "unknown";
  latencyMs: number | null;
  lastChecked: Date | null;
  setHealth: (status: HealthState["status"], latencyMs: number) => void;
}

export const useHealthStore = create<HealthState>((set) => ({
  status: "healthy",
  latencyMs: 42,
  lastChecked: new Date(),
  setHealth: (status, latencyMs) =>
    set({ status, latencyMs, lastChecked: new Date() }),
}));
