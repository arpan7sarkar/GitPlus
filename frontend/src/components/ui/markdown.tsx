import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface MarkdownProps {
  children: string;
  className?: string;
}

/** Renders AI/GitHub-authored markdown with app-styled headings, lists, links and code blocks. */
const Markdown = ({ children, className }: MarkdownProps) => {
  return (
    <div className={className}>
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          h1: ({ children }) => <h1 className="text-base font-semibold text-foreground mt-3 mb-1.5 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-semibold text-foreground mt-3 mb-1.5 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-medium text-foreground mt-2.5 mb-1 first:mt-0">{children}</h3>,
          h4: ({ children }) => <h4 className="text-sm font-medium text-foreground mt-2 mb-1 first:mt-0">{children}</h4>,
          ul: ({ children }) => <ul className="mb-2 last:mb-0 pl-4 list-disc space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 last:mb-0 pl-4 list-decimal space-y-0.5">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="text-foreground font-medium">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-3 my-2 text-muted-foreground italic">{children}</blockquote>
          ),
          hr: () => <hr className="my-3 border-border" />,
          pre: ({ children }) => <>{children}</>,
          code({ className, children }) {
            const match = /language-(\w+)/.exec(className || "");
            const isBlock = Boolean(match) || String(children).includes("\n");
            if (!isBlock) {
              return (
                <code className="px-1 py-0.5 rounded text-[11px] font-mono bg-muted text-primary">
                  {children}
                </code>
              );
            }
            const lang = match?.[1] || "text";
            return (
              <div className="my-2 rounded overflow-hidden border border-border">
                <div className="flex items-center px-3 py-1 bg-muted border-b border-border">
                  <span className="text-[10px] text-muted-foreground uppercase">{lang}</span>
                </div>
                <SyntaxHighlighter
                  language={lang}
                  style={vscDarkPlus}
                  customStyle={{ margin: 0, padding: "10px 14px", background: "hsl(220, 14%, 9%)", fontSize: "11px", lineHeight: "1.5" }}
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
