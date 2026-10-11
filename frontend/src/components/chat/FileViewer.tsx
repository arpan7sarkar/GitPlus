import { useEffect, useMemo, useState } from "react";
import { X, FileCode, Loader2 } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { a11yDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "@/hooks/use-theme";
import type { Citation } from "@/lib/mock-data";
import { useRepoStore } from "@/lib/store";
import { fetchFileContent } from "@/lib/api";

interface FileViewerProps {
  citation: Citation | null;
  onClose: () => void;
  repoOwner?: string;
  repoName?: string;
  githubToken?: string | null;
}

const detectLanguage = (filePath: string): string => {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    css: "css",
    scss: "scss",
    html: "html",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    sql: "sql",
    sh: "bash",
    toml: "toml",
  };
  return map[ext] || "text";
};

const FileViewer = ({ citation, onClose, repoOwner, repoName, githubToken }: FileViewerProps) => {
  const { theme } = useTheme();
  const { fileContents, meta, githubToken: storeToken, upsertFileContent } = useRepoStore();
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const owner = repoOwner ?? meta?.owner;
  const repo = repoName ?? meta?.name;
  const token = githubToken ?? storeToken;

  const fileData = useMemo(
    () => (citation ? fileContents.find((f) => f.path === citation.filePath) : undefined),
    [citation, fileContents]
  );

  useEffect(() => {
    let cancelled = false;

    if (!citation) return;
    if (fileData?.content) return;
    if (!owner || !repo) return;

    setIsLoading(true);
    setLoadError(null);

    fetchFileContent({
      owner,
      repo,
      path: citation.filePath,
      githubToken: token || undefined,
    })
      .then((res: any) => {
        if (cancelled) return;
        if (res.error) {
          setLoadError(res.error);
        } else {
          upsertFileContent({ path: res.path, content: res.content, size: res.size });
        }
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Failed to load file";
        // Make edge function errors more user-friendly
        if (msg.includes("non-2xx")) {
          setLoadError("File fetch service unavailable. The edge function may need to be redeployed.");
        } else {
          setLoadError(msg);
        }
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [citation?.filePath, fileData?.content, owner, repo, token, upsertFileContent, retryCount]);

  const handleRetry = () => {
    setLoadError(null);
    setRetryCount(c => c + 1);
  };

  if (!citation) return null;

  const content =
    fileData?.content ||
    (isLoading
      ? `// ⏳ Fetching file on-demand: ${citation.filePath}\n// This file was not included in the initial index.\n// Loading from GitHub API...`
      : loadError
        ? `// ❌ Failed to load: ${citation.filePath}\n// Error: ${loadError}\n//\n// Click "Retry" in the header to try again.`
        : `// File content not available for: ${citation.filePath}`);

  const language = detectLanguage(citation.filePath);

  const isFullFile = citation.endLine >= 999999;
  const shouldHighlight = !isFullFile;

  return (
    <div className="h-full flex flex-col bg-background border-l border-border">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-xs text-foreground truncate">{citation.filePath}</span>
          {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />}
          {loadError && (
            <button onClick={handleRetry} className="text-xs text-destructive shrink-0 hover:underline cursor-pointer">
              Failed — Retry
            </button>
          )}
          {shouldHighlight && (
            <span className="text-xs text-primary shrink-0">
              L{citation.startLine}–{citation.endLine}
            </span>
          )}
        </div>
        <button onClick={onClose} aria-label="Close file viewer" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-accent sm:h-9 sm:w-9">
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <SyntaxHighlighter
          language={language}
          style={theme === "dark" ? a11yDark : oneLight}
          showLineNumbers
          startingLineNumber={1}
          wrapLines
          lineProps={(lineNumber) => ({
            style: {
              backgroundColor:
                shouldHighlight &&
                lineNumber >= citation.startLine &&
                lineNumber <= citation.endLine
                  ? "hsl(var(--warning) / 0.1)"
                  : undefined,
              borderLeft:
                shouldHighlight &&
                lineNumber >= citation.startLine &&
                lineNumber <= citation.endLine
                  ? "2px solid hsl(var(--warning))"
                  : "2px solid transparent",
              display: "block",
              paddingLeft: "8px",
            },
          })}
          customStyle={{
            margin: 0,
            padding: "6px 0",
            background: "hsl(var(--code-bg))",
            color: "hsl(var(--foreground))",
            fontFamily: '"Geist Mono", monospace',
            fontSize: "13px",
            lineHeight: "1.6",
          }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

export default FileViewer;
