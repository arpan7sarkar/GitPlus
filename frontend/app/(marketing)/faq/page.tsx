"use client";

import { useState } from "react";
import { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const FAQ_ITEMS = [
  {
    q: "What is CodebaseGPT?",
    a: "CodebaseGPT is an AI-powered platform that helps developers understand, audit, document, and chat with any GitHub repository. It indexes your codebase and provides intelligent features like code chat, security scanning, and architecture documentation.",
  },
  {
    q: "Is my code stored or used for training?",
    a: "No. We process your code only during the active session. Code is never stored permanently or used for AI model training. All data is deleted when your session expires.",
  },
  {
    q: "Does it support private repositories?",
    a: "Yes! You can provide a GitHub Personal Access Token (PAT) to index private repositories. The token is stored only in your browser's localStorage and is never sent to any third-party service.",
  },
  {
    q: "What languages are supported?",
    a: "CodebaseGPT supports all programming languages that appear on GitHub. The AI is particularly strong with JavaScript/TypeScript, Python, Go, Rust, Java, C++, and Ruby.",
  },
  {
    q: "How large of a repository can it handle?",
    a: "We support repos up to ~500K lines of source code. For very large repos (100K+ files), we use an on-demand lazy-loading strategy to ensure fast indexing while still providing comprehensive analysis.",
  },
  {
    q: "Is there a free tier?",
    a: "Yes. Unauthenticated users can index up to 5 repositories for free. Sign in with GitHub for unlimited access. There is no credit card required.",
  },
  {
    q: "How accurate is the security scanner?",
    a: "The security scanner runs a 12-point audit covering common vulnerabilities (secrets, XSS, SQL injection, CORS, ReDoS, etc.). It is designed to catch the most impactful issues but is not a replacement for professional security audits.",
  },
  {
    q: "Can I share my analysis with my team?",
    a: "Yes! You can share chat sessions via a unique link. Recipients can view the conversation in read-only mode without needing an account.",
  },
];

export default function FAQPage() {
  const [expanded, setExpanded] = useState<number | null>(0);

  return (
    <div className="max-w-3xl mx-auto px-6 py-24">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-[#111114] mb-4" style={{ fontFamily: "var(--font-display)" }}>
          Frequently Asked Questions
        </h1>
        <p className="text-lg text-[#5B5F66]">
          Everything you need to know about CodebaseGPT.
        </p>
      </div>

      <div className="space-y-3">
        {FAQ_ITEMS.map((item, i) => (
          <div key={i} className="card overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
              className="w-full flex items-center justify-between px-6 py-4 text-left"
            >
              <span className="text-sm font-semibold text-[#111114]">{item.q}</span>
              <ChevronDown
                className={`h-4 w-4 text-[#5B5F66] shrink-0 transition-transform ${
                  expanded === i ? "rotate-180" : ""
                }`}
              />
            </button>
            <AnimatePresence>
              {expanded === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-5 text-sm text-[#5B5F66] leading-relaxed border-t border-[#E5E5E3] pt-4">
                    {item.a}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
