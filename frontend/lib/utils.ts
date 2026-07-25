import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 30) return `${Math.floor(days / 30)}mo ago`;
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h ago`;
  const mins = Math.floor(diff / 60000);
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

export function extractCitations(text: string) {
  const citations: Array<{ filePath: string; startLine: number; endLine: number; snippet: string }> = [];
  const regex = /`?([a-zA-Z0-9_/.\-]+\.[a-zA-Z]+):(\d+)[-–](\d+)`?/g;
  let match;
  const seen = new Set<string>();
  while ((match = regex.exec(text)) !== null) {
    const key = `${match[1]}:${match[2]}-${match[3]}`;
    if (!seen.has(key)) {
      seen.add(key);
      citations.push({
        filePath: match[1],
        startLine: parseInt(match[2]),
        endLine: parseInt(match[3]),
        snippet: `Lines ${match[2]}-${match[3]}`,
      });
    }
    if (citations.length >= 5) break;
  }
  return citations;
}
