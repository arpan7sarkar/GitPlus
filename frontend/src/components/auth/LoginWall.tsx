import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Github, FolderGit2, History, Lock, Loader2, MessageSquare } from "lucide-react";
import { useUserAuth } from "@/hooks/use-user-auth";
import { motion } from "framer-motion";

interface LoginWallProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACCOUNT_FEATURES = [
  { icon: Lock, title: "Repository access", desc: "Connect repositories your GitHub account can access." },
  { icon: History, title: "Saved work", desc: "Return to repositories linked to your account." },
  { icon: FolderGit2, title: "Repository discovery", desc: "Choose a repository directly from your GitHub list." },
  { icon: MessageSquare, title: "Code conversations", desc: "Explore code with file-and-line references." },
];

export function LoginWall({ open, onOpenChange }: LoginWallProps) {
  const { loginWithGitHub } = useUserAuth();
  const [connecting, setConnecting] = useState(false);

  const handleLogin = async () => {
    setConnecting(true);
    const { error } = await loginWithGitHub();
    if (error) setConnecting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle className="text-xl font-semibold">Continue with a GitHub account</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed text-secondary-foreground">
          You have used the five guest repository analyses. Sign in to continue and return to your indexed work.
        </DialogDescription>
        <div className="grid gap-3 py-2 sm:grid-cols-2">
          {ACCOUNT_FEATURES.map(({ icon: Icon, title, desc }) => (
            <motion.div key={title} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className="rounded-lg border border-border bg-card p-4">
              <Icon className="mb-3 h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-secondary-foreground">{desc}</p>
            </motion.div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={handleLogin} disabled={connecting} className="h-11 w-full gap-2">
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Github className="h-4 w-4" aria-hidden="true" />}
            {connecting ? "Connecting to GitHub…" : "Continue with GitHub"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
