"use client";

import { cn } from "@/lib/utils";

interface SkeletonCardProps {
  className?: string;
  lines?: number;
  showAvatar?: boolean;
}

export function SkeletonCard({ className, lines = 3, showAvatar = false }: SkeletonCardProps) {
  return (
    <div className={cn("rounded-xl border border-[#E5E5E3] bg-white p-5 space-y-3", className)}>
      {showAvatar && (
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full shimmer" />
          <div className="space-y-2 flex-1">
            <div className="h-3 shimmer rounded-full w-1/3" />
            <div className="h-2.5 shimmer rounded-full w-1/4" />
          </div>
        </div>
      )}
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 shimmer rounded-full"
          style={{ width: `${100 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonText({ className }: { className?: string }) {
  return <div className={cn("h-3 shimmer rounded-full", className)} />;
}

export function SkeletonBox({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-xl", className)} />;
}
