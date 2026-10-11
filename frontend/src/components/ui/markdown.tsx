import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { a11yDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "@/hooks/use-theme";

interface MarkdownProps {
  children: string;
  className?: string;
}

/** Renders AI/GitHub-authored markdown with app-styled headings, lists, links and code blocks. */
const Markdown = ({ children, className }: MarkdownProps) => {
  const { theme } = useTheme();

  return (
    <div className={`min-w-0 max-w-full [overflow-wrap:anywhere] ${className || ""}`}>
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          h1: ({ children }) => <h1 className="text-xl font-semibold text-foreground mt-3 mb-2 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-semibold text-foreground mt-3 mb-2 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-medium text-foreground mt-2.5 mb-1.5 first:mt-0">{children}</h3>,
          h4: ({ children }) => <h4 className="text-sm font-medium text-foreground mt-2 mb-1 first:mt-0">{children}</h4>,
          ul: ({ children }) => <ul className="mb-2 last:mb-0 pl-4 list-disc space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 last:mb-0 pl-4 list-decimal space-y-0.5">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-2 hover:text-secondary-foreground rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="text-foreground font-medium">{children}</strong>,
          em: ({ children }) => <em className="not-italic font-medium">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-3 my-2 text-secondary-foreground">{children}</blockquote>
          ),
          hr: () => <hr className="my-3 border-border" />,
          pre: ({ children }) => <>{children}</>,
          code({ className, children }) {
            const match = /language-(\w+)/.exec(className || "");
            const isBlock = Boolean(match) || String(children).includes("\n");
            if (!isBlock) {
              return (
                <code className="px-1 py-0.5 rounded text-[13px] font-mono bg-muted text-secondary-foreground">
                  {children}
                </code>
              );
            }
            const lang = match?.[1] || "text";
            return (
              <div className="my-2 min-w-0 max-w-full rounded-md overflow-hidden border border-border">
                <div className="flex items-center px-3 py-1.5 bg-muted border-b border-border">
                  <span className="text-xs text-muted-foreground">{lang}</span>
                </div>
                <SyntaxHighlighter
                  language={lang}
                  style={theme === "dark" ? a11yDark : oneLight}
                  codeTagProps={{ style: { background: "transparent", color: "hsl(var(--foreground))", fontFamily: '"Geist Mono", monospace' } }}
                  customStyle={{ margin: 0, padding: "12px 14px", background: "hsl(var(--muted))", color: "hsl(var(--foreground))", fontFamily: '"Geist Mono", monospace', fontSize: "13px", lineHeight: "1.6", maxWidth: "100%", overflowX: "auto" }}
                >
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
              </div>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
};

export default Markdown;
