"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Code2, Search, LogOut, User, Settings, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRepoStore } from "@/lib/stores/repo-store";
import { useAuthStore } from "@/lib/stores/auth-store";

const TABS = [
  { label: "Overview",       segment: "" },
  { label: "Chat",           segment: "chat" },
  { label: "Security",       segment: "security" },
  { label: "System Design",  segment: "system-design" },
  { label: "Onboarding",     segment: "onboarding" },
  { label: "Issues",         segment: "issues" },
  { label: "PRs",            segment: "prs" },
  { label: "Commits",        segment: "commits" },
];

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const params = useParams();
  const repoId = params?.repoId as string | undefined;
  const { meta } = useRepoStore();
  const { user, logout } = useAuthStore();

  const isRepoPage = pathname.startsWith("/repo/");

  const getActiveSegment = () => {
    if (!repoId) return "";
    const base = `/repo/${repoId}`;
    const rest = pathname.slice(base.length).replace(/^\//, "");
    return rest || "";
  };

  const activeSegment = getActiveSegment();

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      {/* Top nav */}
      <header className="sticky top-0 z-50 border-b border-[#E5E5E3] bg-white/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-14 px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#4338CA] to-[#6366F1] flex items-center justify-center">
                <Code2 className="h-3.5 w-3.5 text-white" />
              </div>
            </Link>

            {meta && isRepoPage && (
              <div className="flex items-center gap-2 text-sm">
                <Link href="/" className="text-[#5B5F66] hover:text-[#111114] transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </Link>
                <span className="text-[#5B5F66]">{meta.owner}</span>
                <span className="text-[#C5C5C3]">/</span>
                <span className="font-semibold text-[#111114]">{meta.name}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg text-[#5B5F66] hover:bg-[#F5F5F4] hover:text-[#111114] transition-colors">
              <Search className="h-4 w-4" />
            </button>

            {user && (
              <div className="flex items-center gap-2 ml-2">
                <Link href="/settings" className="p-2 rounded-lg text-[#5B5F66] hover:bg-[#F5F5F4] hover:text-[#111114] transition-colors">
                  <Settings className="h-4 w-4" />
                </Link>
                <Link href="/profile" className="p-2 rounded-lg text-[#5B5F66] hover:bg-[#F5F5F4] hover:text-[#111114] transition-colors">
                  <User className="h-4 w-4" />
                </Link>
                <button onClick={logout} className="p-2 rounded-lg text-[#5B5F66] hover:bg-[#F5F5F4] hover:text-[#111114] transition-colors">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Pill tab nav — only show on repo pages */}
        {isRepoPage && repoId && (
          <div className="max-w-7xl mx-auto px-6 -mb-px">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0">
              {TABS.map((tab) => {
                const href = tab.segment
                  ? `/repo/${repoId}/${tab.segment}`
                  : `/repo/${repoId}`;
                const isActive = activeSegment === tab.segment;

                return (
                  <Link
                    key={tab.segment}
                    href={href}
                    className="relative px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors"
                  >
                    <span className={cn(
                      isActive ? "text-[#4338CA]" : "text-[#5B5F66] hover:text-[#111114]"
                    )}>
                      {tab.label}
                    </span>
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4338CA] rounded-full"
                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
