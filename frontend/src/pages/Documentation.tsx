import React from "react";
import { Link } from "react-router-dom";
import PageLayout from "@/components/layout/PageLayout";
import { Code, Terminal, Zap, BookOpen, Layers, Shield, Cpu } from "lucide-react";

export default function Documentation() {
  const sections = [
    {
      title: "Core Infrastructure",
      items: [
        { icon: <Cpu className="h-4 w-4" />, label: "Indexing Logic", href: "#workspace-indexing" },
        { icon: <Layers className="h-4 w-4" />, label: "Vector Embeddings", href: "#system-architecture" },
        { icon: <Code className="h-4 w-4" />, label: "Language Support", href: "#semantic-tokenization" }
      ]
    },
    {
      title: "Security & Auditing",
      items: [
        { icon: <Shield className="h-4 w-4" />, label: "Secret Detection", href: "#workspace-indexing" },
        { icon: <Zap className="h-4 w-4" />, label: "Vulnerability Scan", href: "#system-architecture" }
      ]
    }
  ];

  return (
    <PageLayout
      category="Technical Docs"
      title="The Unified Framework"
      subtitle="Deep dive into the architecture, vector engines, and operational layers that drive GitPlus."
    >
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
        <aside className="lg:col-span-3">
          <nav aria-label="Documentation sections" className="grid gap-6 sm:grid-cols-2 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:grid-cols-1 lg:overflow-y-auto lg:p-1">
            {sections.map((section) => (
              <div key={section.title} className="space-y-3">
                <h2 className="text-sm font-medium text-foreground">{section.title}</h2>
                <ul className="space-y-1">
                  {section.items.map((item) => (
                    <li key={item.label}>
                      <a href={item.href} className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm text-secondary-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:min-h-10">
                        <span aria-hidden="true" className="shrink-0 text-muted-foreground">{item.icon}</span>
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 space-y-10 lg:col-span-9">
          <section id="system-architecture" className="scroll-mt-24">
            <div className="mb-5 flex items-center gap-3 text-foreground">
              <div className="rounded-xl border border-border bg-muted p-2.5">
                <BookOpen aria-hidden="true" className="h-5 w-5 text-secondary-foreground" />
              </div>
              <h2 className="m-0 text-xl font-semibold">System Architecture</h2>
            </div>
            <p className="mb-5 border-l-2 border-border pl-4 text-[15px] leading-relaxed text-secondary-foreground">
              GitPlus is built on a distributed indexing engine that treats repositories as coherent biological systems rather than collections of text files.
            </p>
            <p className="text-[15px] leading-relaxed text-secondary-foreground">
              Our platform leverages the distributed vectorization of source code. When you input a repository URL, the system initiates a multi-stage ingestion pipeline designed for speed, security, and semantic depth.
            </p>
            <div className="my-6 grid gap-4 sm:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-border bg-card p-5 sm:p-6">
                <h3 className="m-0 text-lg font-medium text-foreground">Global Context Awareness</h3>
                <p className="m-0 text-sm leading-relaxed text-secondary-foreground">Unlike traditional search tools, we maintain a global understanding of cross-file dependencies and module boundaries.</p>
              </div>
              <div id="semantic-tokenization" className="scroll-mt-24 space-y-3 rounded-2xl border border-border bg-card p-5 sm:p-6">
                <h3 className="m-0 text-lg font-medium text-foreground">Semantic Tokenization</h3>
                <p className="m-0 text-sm leading-relaxed text-secondary-foreground">We use sophisticated AST parsers to understand the intent and structure of your logic before it ever reaches the LLM.</p>
              </div>
            </div>
          </section>

          <section id="workspace-indexing" className="scroll-mt-24">
            <div className="mb-5 flex items-center gap-3 text-foreground">
              <div className="shrink-0 rounded-xl border border-border bg-muted p-2.5">
                <Terminal aria-hidden="true" className="h-5 w-5 text-secondary-foreground" />
              </div>
              <h2 className="m-0 text-xl font-semibold">Workspace & Repository Indexing</h2>
            </div>
            <p className="mb-5 text-sm leading-relaxed text-secondary-foreground">
              Configure your repository access tokens and settings for optimal indexing performance.
            </p>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <p className="border-b border-border px-5 py-3 font-mono text-xs text-muted-foreground">Web Indexer / Environment</p>
              <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed sm:p-6"><code>
                <span className="text-muted-foreground"># Step 1: Input target repository URL in GitPlus dashboard</span>{"\n"}
                <span className="text-secondary-foreground">WEB</span>{" "}<span className="text-foreground">https://github.com/org/repository-name</span>{"\n\n"}
                <span className="text-muted-foreground"># Step 2: (Optional) Set GitHub Personal Access Token for private repos</span>{"\n"}
                <span className="text-secondary-foreground">AUTH</span>{" "}<span className="text-foreground">ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx</span>{"\n\n"}
                <span className="text-muted-foreground"># Step 3: Trigger real-time AST chunking & vector search</span>{"\n"}
                <span className="text-secondary-foreground">SYNC</span>{" "}<span className="text-foreground">gitplus --index-mode full</span>
              </code></pre>
            </div>
          </section>

          <div className="space-y-4 rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
            <h3 className="m-0 text-xl font-semibold leading-tight text-foreground">Need specialized technical guidance?</h3>
            <p className="mx-auto max-w-xl text-sm leading-relaxed text-secondary-foreground">Learn how to integrate GitPlus into your team's workflow and developer setup.</p>
            <div className="pt-2">
              <Link to="/features" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-10">Explore Platform Capabilities</Link>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
