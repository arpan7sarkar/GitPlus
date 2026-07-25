"use client";

import { useHealthStore } from "@/lib/stores/health-store";
import { cn } from "@/lib/utils";

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
  const { status, latencyMs } = useHealthStore();

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
