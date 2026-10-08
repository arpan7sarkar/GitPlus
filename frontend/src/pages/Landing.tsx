import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, BookOpen, ChevronDown, FileCode, FolderGit2,
  Github, GitPullRequest, Lock, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useCompactMode } from "@/hooks/use-compact-mode";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useUserAuth } from "@/hooks/use-user-auth";
import { UserRepos } from "@/components/dashboard/UserRepos";
import { useUsageStore } from "@/lib/usage-store";
import { LoginWall } from "@/components/auth/LoginWall";
import { LoginDialog } from "@/components/auth/LoginDialog";
import { trackVisit } from "@/lib/api";
import AppHeader from "@/components/layout/AppHeader";

const CAPABILITIES = [
  {
    icon: FileCode,
    title: "Explore the codebase",
    description: "Browse source files, search loaded code, and inspect the file hierarchy and generated architecture overview.",
  },
  {
    icon: MessageSquare,
    title: "Ask and verify",
    description: "Ask code questions, open file-and-line references, and return to saved conversations.",
  },
  {
    icon: GitPullRequest,
    title: "Follow GitHub activity",
    description: "Browse issues, pull requests, and commits. Run an on-demand VexReview when you have repository write access.",
  },
  {
    icon: BookOpen,
    title: "Generate working notes",
    description: "Create onboarding and system-design documents, or request AI security findings to review against the source.",
  },
];

const Landing = () => {
  const [repoUrl, setRepoUrl] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const handledAuthErrorKey = useRef<string | null>(null);
  const compact = useCompactMode();
  const { user } = useUserAuth();
  const { indexCount, incrementIndexCount } = useUsageStore();
  const [showLoginWall, setShowLoginWall] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const compactQuery = new URLSearchParams(location.search).get("mode") === "compact" ? "?mode=compact" : "";

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has("auth_error") || handledAuthErrorKey.current === location.key) return;
    handledAuthErrorKey.current = location.key;

    let description = "GitHub sign-in could not be completed. Please try again.";
    switch (params.get("auth_error")) {
      case "invalid_state":
        description = "Your sign-in attempt expired or could not be verified. Please try again.";
        break;
      case "token_exchange_failed":
        description = "GitHub could not complete authorization. Please try signing in again.";
        break;
      case "profile_fetch_failed":
        description = "Your GitHub account details could not be loaded. Please try again.";
        break;
      case "server_error":
        description = "The server could not complete sign-in. Please try again; if it continues, check the server logs and database setup.";
        break;
    }
    toast({ title: "GitHub sign-in failed", description, variant: "destructive" });

    params.delete("auth_error");
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : "", hash: location.hash }, {
      replace: true,
      state: location.state,
    });
  }, [location, navigate]);

  useEffect(() => {
    const trackVisitor = async () => {
      try {
        let visitorId = localStorage.getItem("visitor_id");
        if (!visitorId) {
          visitorId = crypto.randomUUID();
          localStorage.setItem("visitor_id", visitorId);
        }

        await trackVisit(visitorId);
      } catch (error) {
        console.error("Error tracking visitor:", error);
      }
    };

    trackVisitor();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("github_pat");
    if (saved) {
      setGithubToken(saved);
      setShowToken(true);
    }
  }, []);

  const handleIndex = (overrideUrl?: string) => {
    const rawUrl = (overrideUrl || repoUrl).trim();
    let url: string;

    try {
      const parsed = new URL(rawUrl.startsWith("github.com/") ? `https://${rawUrl}` : rawUrl);
      const parts = parsed.pathname.replace(/\/$/, "").split("/").filter(Boolean);
      if (
        parsed.protocol !== "https:" || parsed.hostname !== "github.com" ||
        parsed.port || parsed.username || parsed.password || parts.length !== 2 ||
        !/^[a-zA-Z0-9-]+$/.test(parts[0]) || !/^[a-zA-Z0-9_.-]+$/.test(parts[1])
      ) {
        throw new Error("Invalid repository URL");
      }
      const name = parts[1].replace(/\.git$/, "");
      if (!name || name === "." || name === "..") throw new Error("Invalid repository name");
      url = `https://github.com/${parts[0]}/${name}`;
    } catch {
      const description = "Enter a GitHub repository URL such as https://github.com/owner/repo.";
      setUrlError(description);
      toast({ title: "Invalid URL", description, variant: "destructive" });
      return;
    }

    setUrlError(null);
    if (!user && indexCount >= 5) {
      setShowLoginWall(true);
      return;
    }

    if (githubToken) localStorage.setItem("github_pat", githubToken);
    if (!user) incrementIndexCount();

    navigate(`/index/custom-repo${compactQuery}`, { state: { githubUrl: url, githubToken: githubToken || undefined } });
  };

  const handleRepoClick = (url: string) => {
    setRepoUrl(url);
    handleIndex(url);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main
        id="main-content"
        tabIndex={-1}
        className={`mx-auto w-full max-w-6xl px-4 sm:px-6 ${compact ? "py-6" : "py-8 sm:py-10"}`}
      >
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18 }}
          aria-labelledby="connect-heading"
        >
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="mb-2 text-sm font-medium text-primary">Codebase workspace</p>
              <h1 id="connect-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Understand a repository.
              </h1>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                Connect a GitHub repository to explore its files, inspect architecture,
                follow activity, and ask questions with source references you can verify.
              </p>
            </div>
            {user && (
              <Button asChild variant="outline" className="h-11 gap-2 sm:h-10">
                <Link to={`/repos${compactQuery}`}>
                  <FolderGit2 className="h-4 w-4" aria-hidden="true" /> My Repos
                </Link>
              </Button>
            )}
          </div>

          <form
            className={`rounded-lg border border-border bg-card ${compact ? "p-4" : "p-4 sm:p-6"}`}
            onSubmit={(event) => { event.preventDefault(); handleIndex(); }}
            noValidate
          >
            <label htmlFor="repo-url" className="mb-2 block text-sm font-medium">
              GitHub repository URL
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                id="repo-url"
                name="repository"
                placeholder="https://github.com/owner/repo"
                value={repoUrl}
                onChange={(event) => { setRepoUrl(event.target.value); setUrlError(null); }}
                aria-invalid={Boolean(urlError)}
                aria-describedby={urlError ? "repo-url-error" : "repo-url-help"}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="h-11 min-w-0 flex-1 bg-background font-mono text-sm"
              />
              <Button type="submit" className="h-11 shrink-0 gap-2 px-5 text-sm">
                Analyze repository <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            {urlError ? (
              <p id="repo-url-error" role="alert" className="mt-2 text-sm text-destructive">{urlError}</p>
            ) : (
              <p id="repo-url-help" className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Public repositories work without signing in. Use GitHub sign-in or a token for private access.
              </p>
            )}

            <Collapsible open={showToken} onOpenChange={setShowToken} className="mt-4 border-t border-border pt-3">
              <CollapsibleTrigger className="flex min-h-11 items-center gap-2 rounded-md text-sm font-medium hover:text-primary sm:min-h-9">
                <Lock className="h-4 w-4" aria-hidden="true" /> Private repository access
                <ChevronDown className={`h-4 w-4 transition-transform ${showToken ? "rotate-180" : ""}`} aria-hidden="true" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pb-1 pt-2">
                <label htmlFor="github-pat" className="mb-2 block text-sm font-medium">Personal access token (optional)</label>
                <Input
                  id="github-pat"
                  name="githubToken"
                  type="password"
                  placeholder="GitHub personal access token"
                  value={githubToken}
                  onChange={(event) => setGithubToken(event.target.value)}
                  aria-describedby="github-pat-help"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="h-11 max-w-lg bg-background font-mono text-sm"
                />
                <p id="github-pat-help" className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  Use a token with access to the repository. It is saved in this browser and sent
                  to the backend for GitHub requests. Signed-in GitHub access is used when no token is provided.
                </p>
              </CollapsibleContent>
            </Collapsible>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Repository text may be stored for search and sent to external AI providers.
                Only connect code you are allowed to share.
              </p>
              {!user && (
                <p className="shrink-0 text-sm text-muted-foreground tabular-nums">Guest analyses used: {indexCount}/5</p>
              )}
            </div>
          </form>

          {!user && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button type="button" variant="outline" onClick={() => setShowLoginDialog(true)} className="h-11 gap-2 sm:h-10">
                <Github className="h-4 w-4" aria-hidden="true" /> Sign in with GitHub
              </Button>
              <p className="text-sm text-muted-foreground">Choose accessible repositories and reopen indexed work.</p>
            </div>
          )}
        </motion.section>

        {user && <UserRepos onIndex={handleRepoClick} />}

        <section className={compact ? "mt-6" : "mt-8"} aria-labelledby="workspace-heading">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 id="workspace-heading" className="text-lg font-semibold">Inside the workspace</h2>
            <Link to="/features" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-primary hover:underline sm:min-h-9">
              All features <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {CAPABILITIES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            AI output is a starting point, not a guarantee. Verify findings, suggested changes, and citations against the source.
          </p>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-muted-foreground">GitPlus · Codebase intelligence workspace</p>
          <nav aria-label="Resources" className="flex flex-wrap gap-x-4 gap-y-1">
            {[
              ["How it works", "/how-it-works"], ["Docs", "/docs"], ["FAQ", "/faq"],
              ["Changelog", "/changelog"], ["Privacy", "/privacy"], ["Terms", "/terms"], ["Contact", "/contact"],
            ].map(([label, path]) => (
              <Link key={path} to={path} className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground sm:min-h-9">
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
      <LoginWall open={showLoginWall} onOpenChange={setShowLoginWall} />
      <LoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} />
    </div>
  );
};

export default Landing;
