import { useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Download, Copy, Check, Loader2, FileText, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useRepoStore } from "@/lib/store";
import { generateOnboardingDoc } from "@/lib/api";
import WorkspaceNav from "@/components/layout/WorkspaceNav";
import NoRepoLoaded from "@/components/layout/NoRepoLoaded";
import { toast } from "@/hooks/use-toast";

const OnboardingDoc = () => {
  const { repoId } = useParams();
  const { meta, repoContext } = useRepoStore();
  const repo = meta;

  const [markdown, setMarkdown] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!repo) {
    return (
      <div className="min-h-screen bg-background">
        <WorkspaceNav repoId={repoId ?? ""} active="onboarding" />
        <NoRepoLoaded repoId={repoId} />
      </div>
    );
  }

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const context = repoContext || `Repository: ${repo.name} by ${repo.owner}\nFramework: ${(repo as any).framework || "Unknown"}\nFiles: ${repo.fileCount}`;
      const doc = await generateOnboardingDoc(context);
      setMarkdown(doc);
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to generate onboarding doc",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${repo.name}-onboarding.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <WorkspaceNav
        repoId={repoId ?? ""}
        owner={repo.owner}
        name={repo.name}
        active="onboarding"
        actions={
          markdown ? (
            <>
              <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 text-xs" aria-label="Copy guide to clipboard">
                {copied ? <Check className="h-3.5 w-3.5 mr-1" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5 mr-1" aria-hidden="true" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" onClick={handleDownload} className="h-7 text-xs rounded-full" aria-label="Download guide as markdown">
                <Download className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                .md
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="container mx-auto px-6 py-8 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          {!markdown && !loading && (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
                <FileText className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Generate Onboarding Guide</h1>
              <p className="text-muted-foreground text-sm mb-8 max-w-md mx-auto">
                AI will analyze the codebase and generate a comprehensive onboarding document with setup instructions, key files, patterns, and gotchas.
              </p>
              <Button onClick={handleGenerate} className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono">
                <Zap className="h-4 w-4 mr-2" />
                Generate Onboarding Guide
              </Button>
            </div>
          )}

          {loading && (
            <div className="text-center py-20">
              <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-4" />
              <p className="text-sm text-muted-foreground font-mono">Analyzing codebase and generating guide...</p>
            </div>
          )}

          {markdown && !loading && (
            <div className="prose prose-invert prose-sm max-w-none prose-headings:font-bold prose-headings:text-foreground prose-p:text-secondary-foreground prose-a:text-primary prose-code:text-primary prose-code:bg-secondary prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-code-bg prose-pre:border prose-pre:border-border prose-strong:text-foreground prose-li:text-secondary-foreground">
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const inline = !match;
                    return inline ? (
                      <code className={className} {...props}>{children}</code>
                    ) : (
                      <SyntaxHighlighter
                        style={vscDarkPlus}
                        language={match[1]}
                        customStyle={{ margin: 0, background: "hsl(220, 20%, 8%)", fontSize: "12px" }}
                      >
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    );
                  },
                }}
              >
                {markdown}
              </ReactMarkdown>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};


export default OnboardingDoc;
