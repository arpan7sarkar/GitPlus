import React from "react";
import PageLayout from "@/components/layout/PageLayout";
import { ShieldCheck, Code2, Search, MessageSquare, Database, Lock } from "lucide-react";
import { motion } from "framer-motion";

export default function HowItWorks() {
  const howItWorksFAQ = [
    {
      q: "How does GitPlus index my repository?",
      a: "When you provide a repository URL, our engine performs a structural analysis of the codebase. It parses the file tree, understands module relationships using AST parsers (like Tree-sitter), and creates high-dimensional vector embeddings of code snippets. This allows the AI to maintain global architectural awareness.",
      icon: <Database className="h-5 w-5" />
    },
    {
      q: "Is my source code stored securely?",
      a: "Repository text may be stored for search and sent to external AI providers. Retention and security depend on the deployment and provider. Only connect code you are allowed to share; this interface does not guarantee zero retention or a particular encryption configuration.",
      icon: <ShieldCheck className="h-5 w-5" />
    },
    {
      q: "Which programming languages are supported?",
      a: "GitPlus is language-agnostic. While it has specialized deep-reasoning capabilities for TypeScript, JavaScript, Python, Go, Rust, and Java, it can analyze and reason about any text-based source code in any repository.",
      icon: <Code2 className="h-5 w-5" />
    },
    {
      q: "How does the AI provide such precise answers?",
      a: "Unlike standard LLMs that 'guess', GitPlus uses Retrieval-Augmented Generation (RAG). It first searches your indexed codebase for the most relevant files and context, then feeds that specific data into the AI model, ensuring every answer is grounded in your actual code.",
      icon: <Search className="h-5 w-5" />
    },
    {
      q: "Can I use GitPlus for private repositories?",
      a: "Use a GitHub account or personal access token with access to the repository. Manual tokens are stored in this browser's localStorage, not encrypted, and may be sent to the GitPlus backend for GitHub requests. Only connect repositories you are allowed to share with the configured AI providers.",
      icon: <Lock className="h-5 w-5" />
    },
    {
      q: "What can I actually do with the AI chat?",
      a: "You can ask for architectural overviews, debug complex issues, find specific logic across multiple files, generate documentation, or even ask for security audits. The AI acts as a senior developer who has memorized every line of your project.",
      icon: <MessageSquare className="h-5 w-5" />
    }
  ];

  return (
    <PageLayout category="The Engine" title="How GitPlus Reasons" subtitle="Discover the sophisticated pipeline that transforms raw source code into an interactive, intelligent knowledge base.">
      <div className="mx-auto max-w-4xl">
        <div className="grid gap-5">
          {howItWorksFAQ.map((item, i) => (
            <motion.div key={item.q} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.1 }} viewport={{ once: true }} className="rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-muted/40 sm:p-6">
              <div className="flex items-start gap-4 sm:gap-5">
                <div aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-secondary-foreground">{item.icon}</div>
                <div className="min-w-0 space-y-3">
                  <h2 className="text-lg font-medium leading-snug text-foreground">{item.q}</h2>
                  <p className="max-w-2xl text-[15px] leading-relaxed text-secondary-foreground">{item.a}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="mt-10 space-y-5 rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
          <h2 className="text-xl font-semibold text-foreground">Ready to experience the intelligence?</h2>
          <p className="mx-auto max-w-xl text-[15px] leading-relaxed text-secondary-foreground">Join thousands of developers who are using GitPlus to navigate complex systems with ease.</p>
          <div className="pt-2">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="min-h-11 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-10" onClick={() => window.location.href = '/'}>Initiate Indexing</motion.button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
