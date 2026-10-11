import { useState, type ReactNode } from "react";
import { Link, NavLink, useSearchParams } from "react-router-dom";
import { Code2, FolderGit2, Github, Loader2, LogOut, Menu, Settings, User } from "lucide-react";
import { useUserAuth } from "@/hooks/use-user-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LoginDialog } from "@/components/auth/LoginDialog";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";

const INFO_LINKS = [
  { to: "/features", label: "Features" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/docs", label: "Docs" },
  { to: "/faq", label: "FAQ" },
];

interface AppHeaderProps {
  actions?: ReactNode;
  showInfoLinks?: boolean;
  sticky?: boolean;
}

export default function AppHeader({ actions, showInfoLinks = true, sticky = true }: AppHeaderProps) {
  const { user, loading, logout } = useUserAuth();
  const [searchParams] = useSearchParams();
  const densityQuery = searchParams.get("mode") === "compact" ? "?mode=compact" : "";
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <>
      {showInfoLinks && (
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-foreground">
          Skip to content
        </a>
      )}
      <header className={cn("z-40 shrink-0 border-b border-border bg-background/95", sticky && "sticky top-0")}>
        <nav aria-label="Primary" className="mx-auto flex min-h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link to={`/${densityQuery}`} aria-label="GitPlus home" className="inline-flex min-h-10 shrink-0 items-center gap-2 font-semibold">
            <Code2 className="h-5 w-5 text-primary" aria-hidden="true" />
            <span>GitPlus</span>
          </Link>
          {showInfoLinks && (
            <div className="ml-4 hidden items-center gap-1 md:flex">
              {INFO_LINKS.map(({ to, label }) => (
                <NavLink key={to} to={`${to}${densityQuery}`} className={({ isActive }) => cn(
                  "inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium text-secondary-foreground hover:bg-accent hover:text-foreground",
                  isActive && "bg-accent text-primary",
                )}>
                  {label}
                </NavLink>
              ))}
            </div>
          )}
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {actions}
            <Button asChild variant="ghost" size="sm" className="h-11 min-w-11 px-2 sm:h-10 sm:px-3">
              <NavLink to={`/repos${densityQuery}`} aria-label="My Repos" className={({ isActive }) => cn("inline-flex items-center", isActive && "text-primary")}>
                <FolderGit2 className="h-4 w-4 sm:mr-2" aria-hidden="true" />
                <span className="hidden sm:inline">My Repos</span>
              </NavLink>
            </Button>
            <ThemeToggle />
            {loading ? (
              <span className="inline-flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center" role="status" aria-label="Checking sign-in">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
              </span>
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Account menu" className="h-11 w-11 sm:h-10 sm:w-10">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user.user_metadata?.avatar_url} alt="" />
                      <AvatarFallback className="text-sm">{(user.user_metadata?.user_name || user.email || "U").charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel className="space-y-1 font-normal">
                    <p className="truncate text-sm font-medium">{user.user_metadata?.user_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link to={`/profile${densityQuery}`}><User className="mr-2 h-4 w-4" />Profile</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to={`/repos${densityQuery}`}><FolderGit2 className="mr-2 h-4 w-4" />My Repos</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to={`/settings${densityQuery}`}><Settings className="mr-2 h-4 w-4" />Settings</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void logout()} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setLoginOpen(true)} className="h-11 gap-2 px-3 sm:h-10">
                <Github className="h-4 w-4" aria-hidden="true" />Log in
              </Button>
            )}
            {showInfoLinks && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open navigation menu" className="h-11 w-11 sm:h-10 sm:w-10 md:hidden">
                    <Menu className="h-5 w-5" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {INFO_LINKS.map(({ to, label }) => (
                    <DropdownMenuItem asChild key={to}><Link to={`${to}${densityQuery}`}>{label}</Link></DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link to={`/settings${densityQuery}`}>Settings</Link></DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </nav>
      </header>
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  );
}
