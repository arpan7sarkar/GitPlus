"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, MessageSquare, Shield, Network, FileText,
  Sparkles, Zap, Lock, Globe, BarChart3, GitBranch,
  Search, Code2, Star, Check, Layers, Workflow,
  Cpu, FileCode, CheckCircle2, ChevronRight, Terminal,
  Share2, Eye, ShieldAlert, Sliders, Bell
} from "lucide-react";
import { GithubIcon, TwitterIcon } from "@/components/shared/icons";
import { AnimatedCounter } from "@/components/shared/animated-counter";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useUsageStore } from "@/lib/stores/usage-store";
import { LoginWall } from "@/components/app/login-wall";
import { trackVisit, fetchStats } from "@/lib/api";

// Example Repositories for Quick Click
const QUICK_REPOS = [
  { label: "vercel/next.js", url: "https://github.com/vercel/next.js" },
  { label: "facebook/react", url: "https://github.com/facebook/react" },
  { label: "tailwindlabs/tailwindcss", url: "https://github.com/tailwindlabs/tailwindcss" },
];

// Showcase Tabs
const SHOWCASE_TABS = [
  { id: "overview", label: "Overview", icon: Layers },
  { id: "chat", label: "AI Code Chat", icon: MessageSquare },
  { id: "security", label: "Security Scan", icon: Shield },
  { id: "design", label: "System Design", icon: Network },
  { id: "workflows", label: "Automations", icon: Workflow },
];

// Feature Accordion Items
const ACCORDION_ITEMS = [
  {
    id: "diagrams",
    icon: Eye,
    title: "Eye-catching architecture diagrams, every time",
    description: "Generate auto-updating ASCII and Mermaid system architecture maps for any repository.",
    tag: "Architecture",
  },
  {
    id: "security-control",
    icon: ShieldAlert,
    title: "Control every security touchpoint",
    description: "Automate 12-point audits across CORS, hardcoded secrets, ReDoS, and SQL injections.",
    tag: "Compliance",
  },
  {
    id: "custom-domain",
    icon: Share2,
    title: "Share with your own custom team links",
    description: "Publish interactive codebase onboarding guides to your team domain in one click.",
    tag: "Team Sharing",
  },
  {
    id: "fast-index",
    icon: Zap,
    title: "Lightning-fast repository indexing",
    description: "Process 100k+ line codebases in under 30 seconds with smart on-demand lazy parsing.",
    tag: "Performance",
  },
];

// Integrations List
const INTEGRATIONS = [
  { name: "GitHub", category: "Source Control", icon: GithubIcon, color: "text-[#0F172A]" },
  { name: "Vercel", category: "Deployment", icon: Zap, color: "text-[#000000]" },
  { name: "Slack", category: "Notifications", icon: Bell, color: "text-[#E01E5A]" },
  { name: "Linear", category: "Issue Tracking", icon: Sliders, color: "text-[#5E6AD2]" },
  { name: "VS Code", category: "IDE Extension", icon: Code2, color: "text-[#007ACC]" },
  { name: "OpenAI", category: "LLM Provider", icon: Cpu, color: "text-[#10A37F]" },
  { name: "Supabase", category: "Database", icon: Layers, color: "text-[#3ECF8E]" },
  { name: "Docker", category: "Containers", icon: Terminal, color: "text-[#2496ED]" },
];

// Testimonials
const TESTIMONIALS = [
  {
    quote: "CodebaseGPT saved our engineering team weeks of onboarding friction. New hires understand the architecture on day one.",
    author: "Sarah Chen",
    role: "Staff Engineer at Vercel",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    rating: 5,
  },
  {
    quote: "The automated security scanner caught a CORS misconfiguration before our production launch. Irreplaceable developer tool.",
    author: "Marcus Rivera",
    role: "Security Lead at Stripe",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    rating: 5,
  },
  {
    quote: "Being able to chat directly with 500k+ lines of legacy code with exact line citations is like having senior devs on tap.",
    author: "Elena Rostova",
    role: "VP Engineering at Linear",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    rating: 5,
  },
];

export default function LandingPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const { canIndex } = useUsageStore();
  const [repoUrl, setRepoUrl] = useState("");
  const [activeShowcaseTab, setActiveShowcaseTab] = useState("overview");
  const [activeAccordion, setActiveAccordion] = useState("diagrams");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showLoginWall, setShowLoginWall] = useState(false);
  const [pat, setPat] = useState("");
  const [showPat, setShowPat] = useState(false);
  const [visitorCount, setVisitorCount] = useState<number | null>(null);

  useEffect(() => {
    let visitorId = localStorage.getItem("gitplus_visitor");
    if (!visitorId) {
      visitorId = `v_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      localStorage.setItem("gitplus_visitor", visitorId);
    }
    trackVisit(visitorId);
    fetchStats().then(s => setVisitorCount(s.count));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoaded && !canIndex(!!isSignedIn)) {
      setShowLoginWall(true);
      return;
    }
    const url = repoUrl.trim();
    if (!url) return;
    
    if (pat) {
      localStorage.setItem("github_pat", pat);
    }
    
    const parts = url.replace("https://github.com/", "").split("/");
    const id = `gh-${parts[0]}-${parts[1]}-${Date.now()}`;
    router.push(`/index/${encodeURIComponent(id)}?url=${encodeURIComponent(url)}`);
  };

  const handleQuickClick = (url: string) => {
    if (isLoaded && !canIndex(!!isSignedIn)) {
      setShowLoginWall(true);
      return;
    }
    setRepoUrl(url);
    const parts = url.replace("https://github.com/", "").split("/");
    const id = `gh-${parts[0]}-${parts[1]}-${Date.now()}`;
    router.push(`/index/${encodeURIComponent(id)}?url=${encodeURIComponent(url)}`);
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#0F172A] selection:bg-[#0284C7]/20 selection:text-[#0284C7]">
      {/* ── 1. Hero Section (Data-Meets-Structure Background) ──────────────── */}
      <section className="relative pt-24 sm:pt-32 pb-48 px-6 fillout-hero-bg">
        <div className="max-w-5xl mx-auto text-center relative z-10">
          {/* Top Announcement Badge */}
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/85 backdrop-blur-lg border border-white/70 text-xs font-medium text-[#334155] mb-8 shadow-sm"
          >
            <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-[#0284C7] to-[#6366F1] text-white font-bold text-[10px] uppercase tracking-wider">
              New
            </span>
            <span className="font-semibold">Codebase AI Agent 1.0</span>
            <ChevronRight className="h-3.5 w-3.5 text-[#94A3B8]" />
          </motion.div>

          {/* Large Hero Title — Space Grotesk with blue-to-black gradient */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, type: "spring", stiffness: 100, damping: 20 }}
            className="text-5xl sm:text-6xl md:text-[5.25rem] font-bold tracking-[-0.03em] leading-[1.05] mb-6"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(135deg, #0284C7 0%, #1E40AF 40%, #0F172A 80%)",
              }}
            >
              Codebases
            </span>{" "}
            <span className="text-[#0F172A]">that</span>
            <br className="hidden sm:block" />
            <span className="text-[#0F172A]"> do it </span>
            <span className="relative inline-block">
              <span className="text-[#0F172A]">all</span>
              <motion.span
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.8, duration: 0.5, ease: "easeOut" }}
                className="absolute -bottom-1 left-0 right-0 h-[3px] bg-gradient-to-r from-[#0284C7] to-[#6366F1] rounded-full origin-left"
              />
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="text-base sm:text-lg text-[#475569] max-w-xl mx-auto mb-10 leading-relaxed"
          >
            Understand, audit, document, and chat with any GitHub repository.{" "}
            <span className="font-semibold text-[#0F172A]">Your all-in-one developer intelligence platform.</span>
          </motion.p>

          {/* Structured Input Form — Single-line with integrated button */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.35, type: "spring", stiffness: 100 }}
            className="max-w-xl mx-auto mb-6"
          >
            <motion.div
              animate={isInputFocused ? { scale: 1.015, y: -2 } : { scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white text-[#0F172A] transition-shadow duration-300",
                isInputFocused
                  ? "shadow-[0_20px_60px_rgba(2,132,199,0.22),0_6px_24px_rgba(0,0,0,0.10)] ring-2 ring-[#0284C7]/25"
                  : "shadow-[0_12px_40px_rgba(0,0,0,0.10),0_3px_16px_rgba(0,0,0,0.05)]"
              )}
            >
              <GithubIcon className="h-5 w-5 text-[#94A3B8] shrink-0" />
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                placeholder="github.com/owner/repo"
                className="flex-1 py-1 text-sm placeholder:text-[#94A3B8] text-[#0F172A] border-none focus:outline-none bg-transparent font-mono"
              />
              <motion.button
                type="submit"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white font-semibold text-xs shadow-md transition-colors shrink-0"
              >
                <span>Analyze</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </motion.button>
            </motion.div>
            
            {/* Private Repo PAT Toggle */}
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={() => setShowPat(!showPat)}
                className="text-[11px] text-[#64748B] hover:text-[#0F172A] flex items-center gap-1 transition-colors"
              >
                <Lock className="h-3 w-3" />
                {showPat ? "Hide private repo token" : "Indexing a private repo?"}
              </button>
            </div>
            
            <AnimatePresence>
              {showPat && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mt-3"
                >
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E2E8F0] shadow-sm">
                    <input
                      type="password"
                      value={pat}
                      onChange={(e) => setPat(e.target.value)}
                      placeholder="GitHub Personal Access Token (PAT)"
                      className="flex-1 py-1 text-xs placeholder:text-[#94A3B8] text-[#0F172A] border-none focus:outline-none bg-transparent font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-[#94A3B8] text-center mt-2">
                    Token is only stored in your browser's localStorage.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.form>

          {/* Quick Repos Chips — with branch icon */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.4 }}
            className="flex items-center justify-center flex-wrap gap-2 text-xs"
          >
            <span className="text-[#64748B] text-[11px] font-medium mr-1">Try:</span>
            {QUICK_REPOS.map((repo, i) => (
              <motion.button
                key={repo.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + i * 0.08 }}
                whileHover={{ scale: 1.06, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleQuickClick(repo.url)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/75 hover:bg-white text-[#334155] hover:text-[#0284C7] backdrop-blur-md border border-white/80 hover:border-[#0284C7]/30 transition-all font-mono text-[11px] shadow-sm hover:shadow-md"
              >
                <GitBranch className="h-3 w-3 text-[#94A3B8]" />
                {repo.label}
              </motion.button>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── 2. Fillout Tabbed Showcase Card ────────────────────────────────────── */}
      <section className="relative -mt-32 px-6 z-20 mb-20">
        <div className="max-w-6xl mx-auto">
          {/* Top Horizontal Tab Switcher */}
          <div className="flex items-center justify-center gap-1.5 mb-5 overflow-x-auto pb-2 scrollbar-none">
            <div className="flex items-center gap-1 p-1.5 rounded-2xl bg-white/95 backdrop-blur-xl border border-[#E2E8F0] shadow-lg">
              {SHOWCASE_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeShowcaseTab === tab.id;
                return (
                  <motion.button
                    key={tab.id}
                    onClick={() => setActiveShowcaseTab(tab.id)}
                    whileHover={!isActive ? { scale: 1.02 } : {}}
                    whileTap={{ scale: 0.97 }}
                    className={cn(
                      "relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap",
                      isActive
                        ? "text-white"
                        : "text-[#475569] hover:text-[#0F172A]"
                    )}
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-[#0F172A] rounded-xl shadow-md"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Interactive Card Container */}
          <div className="bento-card p-6 sm:p-10 bg-white border border-[#E2E8F0] shadow-xl overflow-hidden">
            <AnimatePresence mode="wait">
              {activeShowcaseTab === "overview" && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="grid lg:grid-cols-12 gap-8 items-center"
                >
                  <div className="lg:col-span-5 space-y-5">
                    <span className="pill-badge text-[#0284C7] bg-[#F0F9FF] border-[#BAE6FD]">
                      ✦ Code Architecture
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-[-0.02em] leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                      Instant codebase clarity for every engineer
                    </h2>
                    <ul className="space-y-3.5 text-sm text-[#475569]">
                      <li className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-[#0284C7] shrink-0 mt-0.5" />
                        <span>Auto-detect frameworks, entrypoints, and core modules</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-[#0284C7] shrink-0 mt-0.5" />
                        <span>Extract key dependencies and architectural patterns</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-[#0284C7] shrink-0 mt-0.5" />
                        <span>Zero configuration needed — works out of the box</span>
                      </li>
                    </ul>
                    <button
                      onClick={() => handleQuickClick(QUICK_REPOS[0].url)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0F172A] text-white text-xs font-semibold hover:bg-[#1E293B] transition-colors"
                    >
                      <span>Explore overview</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="lg:col-span-7 bg-[#F8FAFC] rounded-2xl p-6 border border-[#E2E8F0]">
                    <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-sm space-y-4 font-mono text-xs">
                      <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                        <span className="font-bold text-[#0F172A]">vercel/next.js</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[11px]">
                          Enterprise Grade
                        </span>
                      </div>
                      <p className="text-[#334155] leading-relaxed font-sans text-xs">
                        Next.js is a full-stack React framework managed by Vercel. Architecture uses a Turborepo monorepo with core logic inside <code className="text-[#0284C7] bg-[#F0F9FF] px-1 rounded">packages/next</code>.
                      </p>
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                          <span className="text-[10px] text-[#64748B] uppercase block">Language</span>
                          <span className="font-bold text-[#0F172A]">TypeScript (94%)</span>
                        </div>
                        <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                          <span className="text-[10px] text-[#64748B] uppercase block">Stars</span>
                          <span className="font-bold text-[#0F172A]">127,400 ★</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeShowcaseTab === "chat" && (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="grid lg:grid-cols-12 gap-8 items-center"
                >
                  <div className="lg:col-span-5 space-y-5">
                    <span className="pill-badge text-[#0284C7] bg-[#F0F9FF] border-[#BAE6FD]">
                      ✦ AI Chat & Citations
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight leading-tight">
                      Chat with full repository context & file citations
                    </h2>
                    <p className="text-sm text-[#475569] leading-relaxed">
                      Ask complex questions and receive precise answers with line-by-line file citations that slide out into interactive code viewers.
                    </p>
                    <button
                      onClick={() => handleQuickClick(QUICK_REPOS[0].url)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0F172A] text-white text-xs font-semibold hover:bg-[#1E293B] transition-colors"
                    >
                      <span>Try AI Chat</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="lg:col-span-7 bg-[#F8FAFC] rounded-2xl p-5 border border-[#E2E8F0] space-y-3">
                    <div className="flex justify-end">
                      <div className="bg-[#0284C7] text-white px-4 py-2.5 rounded-2xl rounded-br-sm text-xs font-medium max-w-xs shadow-sm">
                        How does App Router handle Server Components?
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-[#0F172A] flex items-center justify-center shrink-0">
                        <Sparkles className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div className="bg-white border border-[#E2E8F0] p-4 rounded-2xl rounded-bl-sm text-xs text-[#334155] space-y-2 shadow-sm">
                        <p>App Router renders all components as Server Components by default. Entrypoint is <code className="text-[#0284C7] bg-[#F0F9FF] px-1 rounded">app-render.tsx:45-120</code>.</p>
                        <div className="flex gap-1.5 pt-1">
                          <span className="px-2 py-0.5 rounded bg-[#F0F9FF] text-[#0284C7] border border-[#BAE6FD] font-mono text-[10px]">
                            app-render.tsx:45-120
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeShowcaseTab === "security" && (
                <motion.div
                  key="security"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="grid lg:grid-cols-12 gap-8 items-center"
                >
                  <div className="lg:col-span-5 space-y-5">
                    <span className="pill-badge text-red-600 bg-red-50 border-red-200">
                      ✦ 12-Point Audit
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight leading-tight">
                      Automated 12-point security & vulnerability scanner
                    </h2>
                    <p className="text-sm text-[#475569] leading-relaxed">
                      Detect hardcoded secrets, wildcard CORS rules, ReDoS vulnerabilities, and unvalidated inputs before merging to main.
                    </p>
                  </div>
                  <div className="lg:col-span-7 bg-[#F8FAFC] rounded-2xl p-5 border border-[#E2E8F0] space-y-3">
                    {[
                      { id: "SEC-001", title: "Hardcoded Secret Key", sev: "CRITICAL", bg: "bg-red-50 text-red-700 border-red-200" },
                      { id: "SEC-002", title: "CORS Wildcard Origin", sev: "HIGH", bg: "bg-orange-50 text-orange-700 border-orange-200" },
                      { id: "SEC-005", title: "Missing Schema Input Validation", sev: "MEDIUM", bg: "bg-amber-50 text-amber-700 border-amber-200" },
                    ].map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-[#E2E8F0] shadow-sm">
                        <div className="flex items-center gap-3">
                          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", item.bg)}>{item.sev}</span>
                          <span className="text-xs font-semibold text-[#0F172A]">{item.title}</span>
                        </div>
                        <span className="text-[11px] font-mono text-[#94A3B8]">{item.id}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeShowcaseTab === "design" && (
                <motion.div
                  key="design"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="grid lg:grid-cols-12 gap-8 items-center"
                >
                  <div className="lg:col-span-5 space-y-5">
                    <span className="pill-badge text-emerald-600 bg-emerald-50 border-emerald-200">
                      ✦ Auto Diagrams
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight leading-tight">
                      Auto-generated system design & architecture docs
                    </h2>
                    <p className="text-sm text-[#475569] leading-relaxed">
                      Generate comprehensive system design documents with visual data flow diagrams, caching strategies, and deployment topologies.
                    </p>
                  </div>
                  <div className="lg:col-span-7 bg-[#F8FAFC] rounded-2xl p-6 border border-[#E2E8F0] font-mono text-[11px] text-[#334155] space-y-3">
                    <div className="p-4 bg-white rounded-xl border border-[#E2E8F0] leading-relaxed shadow-sm">
                      <p className="font-bold text-[#0F172A] font-sans text-xs mb-2">Data Flow Pipeline</p>
                      <pre className="text-[10px] text-[#0284C7] overflow-x-auto">
{`Request ──► Edge Middleware ──► App Router (RSC)
                                    │
                            ┌───────▼───────┐
                            │ HTML Stream  │
                            └───────────────┘`}
                      </pre>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeShowcaseTab === "workflows" && (
                <motion.div
                  key="workflows"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="grid lg:grid-cols-12 gap-8 items-center"
                >
                  <div className="lg:col-span-5 space-y-5">
                    <span className="pill-badge text-purple-600 bg-purple-50 border-purple-200">
                      ✦ Smart Automations
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight leading-tight">
                      Automate code reviews & team notifications
                    </h2>
                    <p className="text-sm text-[#475569] leading-relaxed">
                      Trigger automated PR reviews, security alerts, and Slack summaries whenever a developer opens a pull request.
                    </p>
                  </div>
                  <div className="lg:col-span-7 bg-[#F8FAFC] rounded-2xl p-6 border border-[#E2E8F0]">
                    <div className="space-y-2.5">
                      <div className="p-3 bg-white rounded-xl border border-[#E2E8F0] flex items-center justify-between text-xs font-semibold text-[#0F172A]">
                        <span>1. GitHub PR Opened (#62820)</span>
                        <span className="text-emerald-600">Triggered</span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-[#E2E8F0] flex items-center justify-between text-xs font-semibold text-[#0F172A]">
                        <span>2. AI Codebase Review & Diff Scan</span>
                        <span className="text-[#0284C7]">Completed</span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-[#E2E8F0] flex items-center justify-between text-xs font-semibold text-[#0F172A]">
                        <span>3. Slack Alert Sent to #engineering</span>
                        <span className="text-purple-600">Sent</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* ── 3. Ratings & Social Proof Strip ────────────────────────────────────── */}
      <section className="py-10 border-y border-[#E2E8F0] bg-white">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-around gap-6 text-center sm:text-left">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">Trusted by teams</p>
            <p className="text-lg font-bold text-[#0F172A]">Over 4,200+ Repositoried Indexed</p>
          </div>
          <div className="h-8 w-px bg-[#E2E8F0] hidden sm:block" />
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" />
              ))}
            </div>
            <div>
              <p className="text-sm font-bold text-[#0F172A]">5.0 / 5 Rating</p>
              <p className="text-xs text-[#64748B]">From 500+ developer reviews</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. "It all starts with a repository" Bento Grid ─────────────────────── */}
      <section className="py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="pill-badge text-[#0284C7] bg-[#F0F9FF] border-[#BAE6FD]">
            ✦ Features
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-[-0.02em]" style={{ fontFamily: "var(--font-display)" }}>
            It all starts with a repository
          </h2>
          <p className="text-base text-[#475569]">
            Build the exact codebase mental model you need, in minutes.
          </p>
        </div>

        {/* 2x2 Bento Grid */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Bento Card 1 */}
          <div className="bento-card p-8 bg-white flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-[#0F172A]">Analyze with context drag-and-drop</h3>
              <p className="text-sm text-[#475569] leading-relaxed">
                Choose from pre-built AI presets or drag files directly into your prompt for targeted insights.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
              <div className="p-3 bg-white rounded-xl border border-[#E2E8F0] shadow-sm text-xs font-mono text-[#334155]">
                <span className="text-[#0284C7] font-bold">@app-render.tsx</span> attached to context
              </div>
              <div className="w-full bg-[#0284C7]/10 h-2 rounded-full overflow-hidden">
                <div className="bg-[#0284C7] h-full w-3/4 rounded-full" />
              </div>
            </div>
          </div>

          {/* Bento Card 2 */}
          <div className="bento-card p-8 bg-white flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-[#0F172A]">Automate with smart code workflows</h3>
              <p className="text-sm text-[#475569] leading-relaxed">
                Reduce manual review workload with intelligent PR summaries and architectural guards.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 font-mono text-xs">
              <div className="p-2.5 bg-white rounded-lg border border-[#E2E8F0] text-[#0F172A] font-semibold">
                PR Submitted → Security Scan Passed
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-[#E2E8F0] text-[#0284C7]">
                AI Action → Summarized 14 commits
              </div>
            </div>
          </div>

          {/* Bento Card 3 */}
          <div className="bento-card p-8 bg-white flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-[#0F172A]">Secure code & audit risks</h3>
              <p className="text-sm text-[#475569] leading-relaxed">
                Identify credentials, CORS misconfigurations, and outdated packages automatically.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold flex items-center justify-between">
                <span>Critical Risk: Hardcoded Secret</span>
                <span>SEC-001</span>
              </div>
            </div>
          </div>

          {/* Bento Card 4 */}
          <div className="bento-card p-8 bg-white flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-[#0F172A]">Analyze, review, and collaborate</h3>
              <p className="text-sm text-[#475569] leading-relaxed">
                Share full repository views and onboarding guides with team members in real-time.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#0F172A]">Active Session</span>
              <span className="text-xs text-[#0284C7] font-mono">3 Engineers Active</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Interactive Feature Accordion ("Create a lasting impression") ──────── */}
      <section className="py-20 px-6 bg-[#F8FAFC] border-y border-[#E2E8F0]">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="pill-badge text-[#0284C7] bg-[#F0F9FF] border-[#BAE6FD]">
              ✦ Intelligence
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-[-0.02em]" style={{ fontFamily: "var(--font-display)" }}>
              Create a lasting impression
            </h2>
            <p className="text-base text-[#475569]">
              Elevate your engineering team with complete codebase transparency.
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 items-stretch">
            {/* Left Accordion Cards */}
            <div className="lg:col-span-5 space-y-3">
              {ACCORDION_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeAccordion === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveAccordion(item.id)}
                    className={cn(
                      "w-full text-left p-5 rounded-2xl border transition-all duration-200",
                      isActive
                        ? "bg-white border-[#0284C7] shadow-md ring-2 ring-[#0284C7]/20"
                        : "bg-white/60 border-[#E2E8F0] hover:bg-white hover:border-[#CBD5E1]"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                        isActive ? "bg-[#0284C7] text-white" : "bg-[#F1F5F9] text-[#64748B]"
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-[#0F172A] mb-1">{item.title}</h4>
                        <p className="text-xs text-[#64748B] leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right Dynamic Preview Box */}
            <div className="lg:col-span-7 bento-card bg-white p-8 border border-[#E2E8F0] shadow-lg flex flex-col justify-center">
              <AnimatePresence mode="wait">
                {activeAccordion === "diagrams" && (
                  <motion.div
                    key="diagrams"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="space-y-4"
                  >
                    <span className="text-xs font-mono font-bold text-[#0284C7]">System Architecture Visualizer</span>
                    <div className="p-5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] font-mono text-xs space-y-2 text-[#334155]">
                      <div className="p-3 bg-white rounded border border-[#E2E8F0] font-bold text-[#0F172A]">
                        Frontend Router (Next.js 14)
                      </div>
                      <div className="text-center text-[#94A3B8]">↓ HTTP Stream / RSC</div>
                      <div className="p-3 bg-white rounded border border-[#E2E8F0] font-bold text-[#0F172A]">
                        Serverless Edge Functions (100+ Nodes)
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeAccordion === "security-control" && (
                  <motion.div
                    key="security-control"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="space-y-4"
                  >
                    <span className="text-xs font-mono font-bold text-red-600">Security Control Hub</span>
                    <div className="space-y-2">
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 font-medium">
                        ✓ 12 Security Rules Enforced
                      </div>
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-medium">
                        ✓ No Secret Leakage Found
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeAccordion === "custom-domain" && (
                  <motion.div
                    key="custom-domain"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.04 }}
                    className="space-y-4"
                  >
                    <span className="text-xs font-mono font-bold text-purple-600">Team Sharing Link</span>
                    <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] text-xs font-mono text-[#0F172A] flex items-center justify-between">
                      <span>https://docs.yourcompany.com/onboarding</span>
                      <span className="px-2 py-1 rounded bg-[#0284C7] text-white font-sans text-[10px]">Copied!</span>
                    </div>
                  </motion.div>
                )}

                {activeAccordion === "fast-index" && (
                  <motion.div
                    key="fast-index"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="space-y-4"
                  >
                    <span className="text-xs font-mono font-bold text-amber-600">Performance Metrics</span>
                    <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] space-y-2 text-xs">
                      <div className="flex justify-between"><span>Parsing Speed:</span><span className="font-bold text-[#0F172A]">2.4s / 10,000 lines</span></div>
                      <div className="flex justify-between"><span>Memory Footprint:</span><span className="font-bold text-[#0F172A]">Optimized (Lazy Stream)</span></div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. Integrations Wall ──────────────────────────────────────────────── */}
      <section className="py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="pill-badge text-[#0284C7] bg-[#F0F9FF] border-[#BAE6FD]">
            ✦ Ecosystem
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-[-0.02em]" style={{ fontFamily: "var(--font-display)" }}>
            Integrate with all your developer tools
          </h2>
          <p className="text-base text-[#475569]">
            Connect CodebaseGPT directly into your existing workflow.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {INTEGRATIONS.map((tool) => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.name}
                className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm hover:shadow-md hover:border-[#0284C7]/40 transition-all flex items-center gap-3.5"
              >
                <div className="w-10 h-10 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center shrink-0">
                  <Icon className={cn("h-5 w-5", tool.color)} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0F172A]">{tool.name}</h4>
                  <p className="text-[11px] text-[#64748B]">{tool.category}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 7. Testimonials ────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-white border-t border-[#E2E8F0]">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-[-0.02em]" style={{ fontFamily: "var(--font-display)" }}>
              How engineering teams use CodebaseGPT
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bento-card p-6 bg-[#FAF9F6] border border-[#E2E8F0] flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex gap-1">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" />
                    ))}
                  </div>
                  <p className="text-xs text-[#334155] leading-relaxed italic">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>
                <div className="flex items-center gap-3 pt-3 border-t border-[#E2E8F0]">
                  <img
                    src={t.avatar}
                    alt={t.author}
                    className="w-9 h-9 rounded-full object-cover border border-white shadow-sm"
                  />
                  <div>
                    <h5 className="text-xs font-bold text-[#0F172A]">{t.author}</h5>
                    <p className="text-[11px] text-[#64748B]">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. Fillout Dark Bottom CTA Section ───────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto rounded-3xl bg-[#0F172A] text-white p-10 sm:p-16 relative overflow-hidden shadow-2xl">
          <div className="relative z-10 max-w-2xl space-y-6">
            <h2 className="text-3xl sm:text-5xl font-bold tracking-[-0.02em] leading-tight text-white" style={{ fontFamily: "var(--font-display)" }}>
              Make your first repo index in minutes
            </h2>
            <p className="text-base text-slate-300">
              No credit card required. Paste any public or private GitHub link to start analyzing instantly.
            </p>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleQuickClick(QUICK_REPOS[0].url)}
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-[#F59E0B] hover:bg-[#D97706] text-[#0F172A] font-extrabold text-sm shadow-lg transition-all"
            >
              <span>Get started for free</span>
              <ArrowRight className="h-4 w-4" />
            </motion.button>
          </div>
          {/* Subtle background glow */}
          <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-[#0284C7]/20 rounded-full blur-3xl pointer-events-none" />
        </div>
      </section>
      
      {/* ── 9. Visitor Counter ─────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center py-10 bg-[#FAF9F6] border-t border-[#E2E8F0] space-y-2 text-[#475569] font-mono text-xs">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-[#0284C7]" />
          <span>Codebases analyzed by developers:</span>
          {visitorCount !== null ? (
            <AnimatedCounter value={visitorCount} className="font-bold text-[#0F172A] bg-white border border-[#E2E8F0] px-2 py-0.5 rounded shadow-sm" />
          ) : (
            <span className="font-bold text-[#0F172A] bg-white border border-[#E2E8F0] px-2 py-0.5 rounded shadow-sm opacity-50">...</span>
          )}
        </div>
      </div>
      <LoginWall open={showLoginWall} onClose={() => setShowLoginWall(false)} />
    </div>
  );
}
