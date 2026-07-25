"use client";

import { useEffect, useCallback } from "react";
import { useHealthStore } from "@/lib/stores/health-store";
import { cn } from "@/lib/utils";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api";

const statusColors = {
  healthy:  "bg-emerald-500",
  degraded: "bg-yellow-500",
  down:     "bg-red-500",
  unknown:  "bg-slate-400",
};

const statusLabels = {
  healthy:  "All systems operational",
  degraded: "Degraded performance",
  down:     "Service disruption",
  unknown:  "Status unknown",
};

export function KeepAliveStatus() {
  const { status, latencyMs, setHealth } = useHealthStore();

  const checkHealth = useCallback(async () => {
    const start = Date.now();
    try {
      // /api → strip /api to get base server URL for /health
      const healthUrl = API_BASE.replace(/\/api\/?$/, "/health");
      const res = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
      const latency = Date.now() - start;
      if (res.ok) {
        setHealth(latency > 2000 ? "degraded" : "healthy", latency);
      } else {
        setHealth("degraded", latency);
      }
    } catch {
      setHealth("down", Date.now() - start);
    }
  }, [setHealth]);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 60_000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  return (
    <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-[#E5E5E3] shadow-[0_2px_12px_rgba(0,0,0,0.06)] text-[11px]">
      <span className={cn("w-2 h-2 rounded-full", statusColors[status], status === "healthy" && "animate-pulse")} />
      <span className="text-[#5B5F66] hidden sm:inline">{statusLabels[status]}</span>
      {latencyMs !== null && (
        <span className="text-[#5B5F66] font-mono">{latencyMs}ms</span>
      )}
    </div>
  );
}
