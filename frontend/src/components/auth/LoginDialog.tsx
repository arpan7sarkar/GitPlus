import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Github, Loader2 } from "lucide-react";
import { useUserAuth } from "@/hooks/use-user-auth";

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoginDialog({ open, onOpenChange }: LoginDialogProps) {
  const { loginWithGitHub } = useUserAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    const { error } = await loginWithGitHub();
    if (error) setIsLoggingIn(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="text-xl font-semibold">Sign in to GitPlus</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed">
          Connect your GitHub account to select accessible repositories and return to your indexed work.
        </DialogDescription>
        <Button onClick={handleLogin} disabled={isLoggingIn} className="mt-3 h-11 gap-2">
          {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Github className="h-4 w-4" aria-hidden="true" />}
          {isLoggingIn ? "Connecting to GitHub…" : "Continue with GitHub"}
        </Button>
        <p className="text-sm text-muted-foreground">You will be redirected to GitHub to authorize access.</p>
      </DialogContent>
    </Dialog>
  );
}
