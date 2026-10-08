import { useNavigate } from "react-router-dom";
import { FolderGit2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NoRepoLoaded({ repoId }: { repoId?: string }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="flex flex-col items-center text-center gap-4 max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-muted border border-border flex items-center justify-center">
          <FolderGit2 className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground mb-1">No repository loaded</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {repoId
              ? `There's no indexed data for "${repoId}" in this browser. Index the repository to explore it.`
              : "Index a repository first, then come back to explore it here."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => navigate("/")} className="rounded-full">
            Index a repository
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/repos")} className="rounded-full">
            My repos
          </Button>
        </div>
      </div>
    </div>
  );
}
