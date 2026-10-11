import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import AppHeader from "@/components/layout/AppHeader";
import { cn } from "@/lib/utils";

export type WorkspaceTab =
  | "dashboard" | "chat" | "issues" | "prs" | "commits"
  | "onboarding" | "security" | "system-design";

const TABS: { id: WorkspaceTab; label: string; suffix: string }[] = [
  { id: "dashboard", label: "Overview", suffix: "" },
  { id: "chat", label: "Chat & files", suffix: "/chat" },
  { id: "issues", label: "Issues", suffix: "/issues" },
  { id: "prs", label: "Pull requests", suffix: "/prs" },
  { id: "commits", label: "Commits", suffix: "/commits" },
  { id: "security", label: "Security", suffix: "/security" },
  { id: "system-design", label: "System design", suffix: "/system-design" },
  { id: "onboarding", label: "Onboarding", suffix: "/onboarding" },
];

interface WorkspaceNavProps {
  repoId: string;
  owner?: string;
  name?: string;
  active: WorkspaceTab;
  actions?: ReactNode;
  sticky?: boolean;
  badge?: ReactNode;
}

export default function WorkspaceNav({ repoId, owner, name, active, actions, sticky = true, badge }: WorkspaceNavProps) {
  const [searchParams] = useSearchParams();
  const search = searchParams.get("mode") === "compact" ? "?mode=compact" : "";
  const base = `/repo/${repoId}`;
  const navRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const selected = nav?.querySelector('[aria-current="page"]');
    if (!nav || !selected) return;
    const bounds = nav.getBoundingClientRect();
    const item = selected.getBoundingClientRect();
    if (item.left < bounds.left) nav.scrollLeft += item.left - bounds.left;
    else if (item.right > bounds.right) nav.scrollLeft += item.right - bounds.right;
  }, [active]);

  return (
    <div className={cn("z-40 shrink-0 bg-background", sticky && "sticky top-0")}>
      <AppHeader showInfoLinks={false} sticky={false} />
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            {active !== "dashboard" && (
              <Link to={`${base}${search}`} aria-label="Back to repository overview" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground sm:h-9 sm:w-9">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
            <span className="min-w-0 break-all font-mono text-sm">
              {owner && name ? <><span className="text-muted-foreground">{owner} / </span><span className="font-medium">{name}</span></> : "Repository workspace"}
            </span>
            {badge}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        <nav ref={navRef} aria-label="Workspace sections" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2 pt-1 sm:px-6">
          {TABS.map(({ id, label, suffix }) => (
            <Link key={id} to={`${base}${suffix}${search}`} aria-current={id === active ? "page" : undefined} className={cn(
              "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors sm:min-h-9",
              id === active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}>
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
