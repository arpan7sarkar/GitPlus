import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { GitBranch, Star, GitFork, MessageSquare, ExternalLink, Loader2, FolderGit2 } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { useUserAuth } from "@/hooks/use-user-auth";
import { fetchIndexedRepos, type IndexedRepoEntry } from "@/lib/api";
import { LoginDialog } from "@/components/auth/LoginDialog";

const MyRepos = () => {
  const { user, loading: authLoading } = useUserAuth();
  const navigate = useNavigate();
  const [repos, setRepos] = useState<IndexedRepoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchIndexedRepos()
      .then(setRepos)
      .catch((err) => console.error("[my-repos] Failed to load indexed repos:", err))
      .finally(() => setLoading(false));
  }, [user]);

  if (!authLoading && !user) {
    return (
      <PageLayout title="My Repos" subtitle="Sign in to see every repository you've analyzed." category="Account">
        <div className="flex flex-col items-center text-center py-16 gap-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <FolderGit2 className="h-7 w-7 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground max-w-sm">
            Your indexed repos are tied to your GitHub account. Sign in to see the full list and jump back into any of them.
          </p>
          <Button onClick={() => setShowLoginDialog(true)} className="rounded-full">Sign in with GitHub</Button>
        </div>
        <LoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="My Repos"
      subtitle="Every repository you've analyzed, ready to pick back up."
      category="Account"
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading your repositories...</p>
        </div>
      ) : repos.length === 0 ? (
        <div className="flex flex-col items-center text-center py-16 gap-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <FolderGit2 className="h-7 w-7 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground max-w-sm">
            You haven't analyzed any repositories yet. Paste a GitHub URL on the homepage to get started.
          </p>
          <Button onClick={() => navigate("/")} className="rounded-full">Index a repository</Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {repos.map((repo, i) => (
            <motion.div
              key={repo.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.4) }}
              className="rounded-2xl border border-border/40 bg-card p-6 flex flex-col gap-4 hover:border-primary/30 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <GitBranch className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{repo.owner}</p>
                    <h3 className="text-sm font-semibold text-foreground truncate">{repo.name}</h3>
                  </div>
                </div>
                <a
                  href={`https://github.com/${repo.owner}/${repo.name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                  title="View on GitHub"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 h-8">
                {repo.description || "No description provided."}
              </p>

              <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                {repo.language && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    {repo.language}
                  </span>
                )}
                {repo.stars !== null && (
                  <span className="flex items-center gap-1"><Star className="h-3 w-3" /> {repo.stars.toLocaleString()}</span>
                )}
                {repo.forks !== null && (
                  <span className="flex items-center gap-1"><GitFork className="h-3 w-3" /> {repo.forks.toLocaleString()}</span>
                )}
              </div>

              <div className="mt-auto flex items-center justify-between pt-3 border-t border-border/40">
                <span className="text-[10px] text-muted-foreground">
                  Indexed {new Date(repo.lastIndexedAt).toLocaleDateString()}
                </span>
                {/* Routes through the dashboard, not chat directly — dashboard has the
                    auto-fetch fallback that repopulates state on a cold page load
                    (e.g. arriving straight from this list); chat doesn't, and would
                    silently fall back to demo data if opened first. */}
                <Button
                  size="sm"
                  onClick={() => navigate(`/repo/${repo.repoId}`)}
                  className="h-7 px-3 text-[11px] rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <MessageSquare className="h-3 w-3 mr-1.5" /> Open
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </PageLayout>
  );
};

export default MyRepos;
