"use client";

import { cn } from "@/lib/utils";

type Severity = "critical" | "high" | "medium" | "low" | "info";

const config: Record<Severity, { label: string; classes: string }> = {
  critical: { label: "Critical", classes: "bg-red-50 text-red-700 border-red-200" },
  high:     { label: "High",     classes: "bg-orange-50 text-orange-700 border-orange-200" },
  medium:   { label: "Medium",   classes: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  low:      { label: "Low",      classes: "bg-slate-50 text-slate-600 border-slate-200" },
  info:     { label: "Info",     classes: "bg-blue-50 text-blue-600 border-blue-200" },
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const { label, classes } = config[severity] ?? config.info;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border", classes, className)}>
      {label}
    </span>
  );
}
