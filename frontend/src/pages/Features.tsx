import React from "react";
import PageLayout from "@/components/layout/PageLayout";
import { Zap, Shield, Cpu, Globe, Layers, Terminal, Share2, Sparkles, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

export default function Features() {
  const coreFeatures = [
    {
      icon: <Cpu className="h-6 w-6 text-secondary-foreground" />,
      title: "Neural Code Reasoning",
      description: "Harness Gemini 1.5 Pro's 1M+ token context window to reason about your entire codebase simultaneously.",
      details: ["Cross-file dependency mapping", "Complex architectural reasoning", "Logic flow visualization"]
    },
    {
      icon: <Zap className="h-6 w-6 text-secondary-foreground" />,
      title: "Hyper-Speed Indexing",
      description: "Our proprietary vector engine processes 10,000+ lines per second without sacrificing precision.",
      details: ["Incremental background sync", "Deltas-only processing", "Low-latency retrieval"]
    },
    {
      icon: <Shield className="h-6 w-6 text-secondary-foreground" />,
      title: "Autonomous Security",
      description: "Security scanning that actually understands the context, reducing false positives by 85%.",
      details: ["Zero-day vulnerability detection", "Secret leak prevention", "Compliance-ready auditing"]
    }
  ];
  const advancedTools = [
    { icon: <Share2 className="h-5 w-5" />, title: "Collaborative Intelligence", description: "Share live AI-indexed sessions with team members for instant onboarding and peer review." },
    { icon: <Terminal className="h-5 w-5" />, title: "Interactive System Design", description: "Generate live Mermaid.js architecture diagrams directly from your current file structure." },
    { icon: <BarChart3 className="h-5 w-5" />, title: "Code Health Metrics", description: "Track complexity, technical debt, and test coverage trends with AI-calculated scores." }
  ];

  return (
    <PageLayout category="Capabilities" title="The Future of Codebase Intelligence" subtitle="GitPlus combines massive context windows with high-precision vector search to give you a god-mode view of your software.">
      <section className="space-y-5">
        <h2 className="flex items-center gap-3 text-xl font-semibold text-foreground">
          <Sparkles aria-hidden="true" className="h-5 w-5 text-secondary-foreground" /> Core Intelligence
        </h2>
        <div className="grid gap-5 lg:grid-cols-3">
          {coreFeatures.map((feature, i) => (
            <motion.div key={feature.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }} className="rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-muted/40 sm:p-6">
              <div aria-hidden="true" className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted">{feature.icon}</div>
              <h3 className="mb-3 text-lg font-medium text-foreground">{feature.title}</h3>
              <p className="mb-5 text-sm leading-relaxed text-secondary-foreground">{feature.description}</p>
              <div className="space-y-3">
                {feature.details.map((detail) => (
                  <div key={detail} className="flex items-start gap-3">
                    <div aria-hidden="true" className="mt-2 h-px w-3 shrink-0 bg-border" />
                    <span className="text-[13px] leading-relaxed text-muted-foreground">{detail}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="my-10">
        <div className="overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="flex flex-col items-center gap-8 lg:flex-row">
            <div className="min-w-0 flex-grow space-y-5">
              <div className="w-fit rounded-full border border-border bg-muted px-3 py-1.5">
                <span className="text-xs font-medium text-muted-foreground">Semantic Stack Analysis</span>
              </div>
              <h2 className="text-xl font-semibold leading-tight text-foreground">Global Semantic Understanding</h2>
              <p className="max-w-xl text-[15px] leading-relaxed text-secondary-foreground">
                Our engine treats your repository as a single multidimensional entity.
                Instead of searching for keywords, we map concepts across the entire stack.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                {['TypeScript', 'Go', 'Rust', 'Java', 'Python', 'C++'].map(lang => (
                  <span key={lang} className="rounded-lg border border-border bg-muted px-3 py-1.5 text-[13px] text-muted-foreground">{lang}</span>
                ))}
              </div>
            </div>
            <div aria-hidden="true" className="flex h-48 w-48 shrink-0 items-center justify-center rounded-full border border-border bg-muted p-8 sm:h-60 sm:w-60">
              <Globe className="h-24 w-24 text-muted-foreground" />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="flex items-center gap-3 text-xl font-semibold text-foreground">
          <Layers aria-hidden="true" className="h-5 w-5 text-secondary-foreground" /> Advanced Tooling
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          {advancedTools.map((tool) => (
            <div key={tool.title} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-muted/40 sm:p-6">
              <div aria-hidden="true" className="text-secondary-foreground">{tool.icon}</div>
              <h3 className="text-lg font-medium text-foreground">{tool.title}</h3>
              <p className="text-sm leading-relaxed text-secondary-foreground">{tool.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 space-y-5 border-t border-border px-4 pt-8 text-center">
        <h2 className="mx-auto max-w-4xl text-xl font-semibold text-foreground"> Ready to index the future?</h2>
        <p className="mx-auto max-w-2xl text-[15px] leading-relaxed text-secondary-foreground">Start your transformation today. Connect your first repository and see the difference AI intelligence makes.</p>
        <button className="min-h-11 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-10">Initiate Repository Indexing</button>
      </section>
    </PageLayout>
  );
}
