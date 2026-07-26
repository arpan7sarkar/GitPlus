import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import {
  ArrowRight, Zap, MessageSquare, FileCode, Code2, Lock, ChevronDown,
  Shield, GitBranch, Search, Brain, BarChart3, Bug, Github, LogOut, User, Settings as SettingsIcon,
  Sparkles, Terminal, Package, Download, Boxes, Cpu, Copy, Check, Play, Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useCompactMode } from "@/hooks/use-compact-mode";
import { useTheme } from "@/hooks/use-theme";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useUserAuth } from "@/hooks/use-user-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserRepos } from "@/components/dashboard/UserRepos";
import { useUsageStore } from "@/lib/usage-store";
import { LoginWall } from "@/components/auth/LoginWall";
import { Progress } from "@/components/ui/progress";
import { LoginDialog } from "@/components/auth/LoginDialog";
import { trackVisit, fetchVisitStats } from "@/lib/api";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

const CountUp = ({ end, duration = 2 }: { end: number, duration?: number }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const updateCount = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      setCount(Math.floor(progress * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(updateCount);
      }
    };

    animationFrame = requestAnimationFrame(updateCount);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return <span>{count.toLocaleString()}</span>;
};

const FEATURES = [
  {
    icon: Search,
    title: "AI-Powered Code Chat",
    desc: "Ask natural language questions about any codebase. Get precise answers with file references and line numbers.",
  },
  {
    icon: Brain,
    title: "Instant Onboarding Docs",
    desc: "Auto-generate comprehensive onboarding documentation so new developers can ramp up in minutes.",
  },
  {
    icon: Shield,
    title: "Security Scanning",
    desc: "Detect vulnerabilities, misconfigurations, and security anti-patterns across the entire repository.",
  },
  {
    icon: BarChart3,
    title: "Architecture Overview",
    desc: "Visualize dependency graphs, understand system design, and map the full project structure.",
  },
  {
    icon: Bug,
    title: "Issue Solver",
    desc: "Fetch GitHub issues and get AI-generated solutions with exact code changes and root cause analysis.",
  },
  {
    icon: GitBranch,
    title: "Private Repo Support",
    desc: "Securely index private repositories using a personal access token stored only in your browser.",
  },
  {
    icon: Sparkles,
    title: "VexReview: AI PR Reviewer",
    desc: "Automate code reviews and PR summaries using Gemini 1.5. Get line-by-line suggestions and chat with your PRs.",
  },
];

const FAQ = [
  {
    q: "How does GitPlus index my repository?",
    a: "GitPlus clone-indexes your codebase into ephemeral memory, extracts deep structural metadata, and maps dependencies using vector embeddings.",
  },
  {
    q: "Is my code secure?",
    a: "Yes. GitPlus is built with a zero-retention architecture. Source code is processed in transient memory and never persisted.",
  },
  {
    q: "Which languages are supported?",
    a: "GitPlus is language-agnostic. It works with any GitHub repository regardless of language, framework, or project structure.",
  },
  {
    q: "How accurate are the AI responses?",
    a: "Answers are grounded in your actual codebase context. The AI cites specific files and line numbers, so you can always verify. Complex or ambiguous questions may require follow-up prompts.",
  },
];

const Landing = () => {
  const [repoUrl, setRepoUrl] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const navigate = useNavigate();
  const compact = useCompactMode();
  const { user, loginWithGitHub, logout, loading } = useUserAuth();
  const { theme, toggleTheme } = useTheme();
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const navBg = useTransform(smoothProgress, [0, 0.05], [0, 1]);
  const { indexCount, incrementIndexCount } = useUsageStore();
  const [showLoginWall, setShowLoginWall] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [visitorCount, setVisitorCount] = useState<number | null>(null);

  useEffect(() => {
    const trackVisitor = async () => {
      try {
        let visitorId = localStorage.getItem("visitor_id");
        if (!visitorId) {
          visitorId = crypto.randomUUID();
          localStorage.setItem("visitor_id", visitorId);
        }

        // Track visit via Express API
        await trackVisit(visitorId);

        // Fetch total unique visitors
        const stats = await fetchVisitStats();
        if (stats && typeof stats.count === "number") {
          setVisitorCount(stats.count);
        }
      } catch (error) {
        console.error("Error tracking visitor:", error);
      }
    };

    trackVisitor();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("github_pat");
    if (saved) {
      setGithubToken(saved);
      setShowToken(true);
    }
  }, []);

  const handleIndex = (overrideUrl?: string) => {
    const url = overrideUrl || repoUrl;

    if (!url.includes("github.com")) {
      toast({ title: "Invalid URL", description: "Please enter a valid GitHub repository URL.", variant: "destructive" });
      return;
    }

    if (!user && indexCount >= 5) {
      console.log("Limit hit, showing LoginWall", { indexCount });
      setShowLoginWall(true);
      return;
    }

    if (githubToken) localStorage.setItem("github_pat", githubToken);
    if (!user) incrementIndexCount();

    navigate(`/index/custom-repo`, { state: { githubUrl: url, githubToken: githubToken || undefined } });
  };

  const handleRepoClick = (url: string) => {
    setRepoUrl(url);
    handleIndex(url);
  };

  const content = compact ? (
    <div className="h-screen flex flex-col bg-background p-3">
      <div className="flex items-center gap-2 mb-3">
        <Code2 className="h-4 w-4 text-primary" />
        <span className="font-mono text-xs font-medium text-foreground">GitPlus</span>
      </div>
      <div className="mb-3">
        <div className="flex gap-1.5">
          <Input
            placeholder="github.com/owner/repo"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleIndex()}
            className="h-8 font-mono text-xs bg-card border-border"
          />
          <Button onClick={() => handleIndex()} size="sm" className="h-8 px-3 text-xs shrink-0">
            Go
          </Button>
        </div>

        <Collapsible open={showToken} onOpenChange={setShowToken}>
          <CollapsibleTrigger className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors mt-1.5">
            <Lock className="h-2.5 w-2.5" /> Private repo?
            <ChevronDown className={`h-2.5 w-2.5 transition-transform ${showToken ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Input
              type="password"
              placeholder="GitHub Personal Access Token"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              className="h-7 font-mono text-[10px] bg-card border-border mt-1.5"
            />
          </CollapsibleContent>
        </Collapsible>
      </div>
      <p className="text-[10px] text-muted-foreground">Paste any GitHub URL to get started.</p>
    </div>
  ) : (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/25 relative">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-2.5 group cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/15 transition-all">
              <Code2 className="h-4.5 w-4.5 text-primary" />
            </div>
            <span className="font-display text-base font-bold tracking-tight transition-colors group-hover:text-primary">GitPlus</span>
          </div>

          <div className="hidden md:flex items-center gap-1">
            <Link to="/features" className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted">Features</Link>
            <Link to="/how-it-works" className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted">How it works</Link>
            <Link to="/faq" className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted">FAQ</Link>
            <Link to="/docs" className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted">Docs</Link>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full border border-border p-0 overflow-hidden hover:bg-muted">
                    <Avatar className="h-full w-full">
                      <AvatarImage src={user.user_metadata.avatar_url} />
                      <AvatarFallback className="bg-muted text-[10px] font-bold">{user.user_metadata.user_name?.[0]}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <DropdownMenuLabel className="font-semibold text-xs py-3 px-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-foreground">{user.user_metadata.user_name}</span>
                      <span className="text-[10px] text-muted-foreground font-medium">{user.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/profile")} className="text-xs py-3 px-4 cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/settings")} className="text-xs py-3 px-4 cursor-pointer">
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => logout()} className="text-xs py-3 px-4 text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowLoginDialog(true)} className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Log in
                </Button>
                <Button size="sm" onClick={() => setShowLoginDialog(true)} className="h-9 px-4 text-[13px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all rounded-full">
                  Try GitPlus
                </Button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-32 overflow-hidden">
        <div className="radial-glow w-[700px] h-[700px] top-0 left-1/2 -translate-x-1/2 -translate-y-1/3" />

        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
            className="pill-badge mx-auto mb-8 bg-card border-border shadow-sm"
          >
            <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-bold text-[10px] uppercase tracking-wider">New</span>
            <span className="text-foreground/80">Hierarchical RAG chat with live citations</span>
            <ChevronDown className="h-3 w-3 -rotate-90 text-muted-foreground" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, type: "spring", stiffness: 100, damping: 20 }}
            className="font-display text-5xl sm:text-6xl md:text-7xl font-bold tracking-[-0.03em] leading-[1.05] mb-6"
          >
            <span className="hero-gradient-text">Codebases</span> that{" "}
            <span className="relative inline-block">
              explain themselves
              <motion.span
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.7, duration: 0.5, ease: "easeOut" }}
                className="absolute -bottom-1 left-0 right-0 h-[3px] bg-primary rounded-full origin-left"
              />
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed"
          >
            Understand, audit, document, and chat with any GitHub repository —{" "}
            <span className="font-medium text-foreground">with real citations, not guesses.</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, type: "spring", stiffness: 100 }}
            className="w-full max-w-xl mx-auto space-y-3"
          >
            <div className="flex flex-col sm:flex-row items-center gap-2 p-2 rounded-2xl soft-card focus-within:border-primary/50 transition-all">
              <div className="flex-grow flex items-center px-3 w-full">
                <Github className="h-4 w-4 text-muted-foreground shrink-0 mr-2.5" />
                <input
                  placeholder="github.com/owner/repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleIndex()}
                  className="w-full bg-transparent border-none outline-none font-mono text-sm placeholder:text-muted-foreground/50 text-foreground py-2"
                />
              </div>
              <Button onClick={() => handleIndex()} className="w-full sm:w-auto h-10 px-5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all shrink-0">
                Analyze <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>

            {!user && (
              <div className="px-4 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                  <span>Free tier</span>
                  <span>{indexCount}/5 repos used</span>
                </div>
                <Progress value={(indexCount / 5) * 100} className="h-1" />
              </div>
            )}

            <Collapsible open={showToken} onOpenChange={setShowToken} className="pt-1">
              <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors mx-auto">
                <Lock className="h-3 w-3" /> Need private repo access?
                <ChevronDown className={`h-3 w-3 transition-transform ${showToken ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-3 flex flex-col gap-2.5 p-4 rounded-2xl soft-card max-w-md mx-auto">
                  <input
                    type="password"
                    placeholder="GitHub Personal Access Token"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-primary/50 transition-all"
                  />
                  <p className="text-[11px] text-muted-foreground text-center">Token stays in your browser's local storage only.</p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </motion.div>

          {/* Quick stat pill */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="pill-badge mx-auto mt-8 bg-transparent border-transparent text-muted-foreground"
          >
            <Github className="h-3.5 w-3.5" />
            Trusted by {visitorCount !== null ? <CountUp end={visitorCount} /> : "0"}+ developers
          </motion.div>

          {/* User Repos list if exists */}
          {user && (
            <div className="mt-16">
              <UserRepos onIndex={handleRepoClick} />
            </div>
          )}

          {/* Logo Cloud Section */}
          <div className="mt-24 pt-12 border-t border-border overflow-hidden">
            <p className="text-xs font-medium text-muted-foreground mb-10">Built for engineers working with</p>
            <div className="flex flex-wrap justify-center items-center gap-x-10 gap-y-6 opacity-40 grayscale">
              {['OpenAI', 'Google', 'Anthropic', 'NVIDIA', 'Vercel', 'GitHub', 'Meta'].map(client => (
                <span key={client} className="font-display text-lg md:text-xl font-semibold tracking-tight select-none">{client}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* VexReview Featured Section */}
      <section id="how-it-works" className="relative py-24 border-t border-border overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 relative z-10 mb-24">
          <div className="soft-card-elevated p-10 md:p-16 relative overflow-hidden text-center">
            <div className="radial-glow w-[500px] h-[500px] top-0 left-1/2 -translate-x-1/2 -translate-y-1/2" />

            <div className="max-w-2xl mx-auto space-y-10 relative z-10">
              <div className="space-y-5">
                <span className="pill-badge mx-auto text-primary bg-primary/5 border-primary/20">
                  <Sparkles className="h-3.5 w-3.5" /> VexReview — AI PR Reviewer
                </span>

                <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-[-0.02em] leading-tight">
                  Next-gen reviews, <span className="text-primary">for next-gen code.</span>
                </h2>

                <p className="text-base text-muted-foreground leading-relaxed max-w-lg mx-auto">
                  Powered by open-source LLMs, VexReview automates code review — line-by-line suggestions and summaries, directly in your GitHub pull requests.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-8 border-y border-border">
                {[
                  { title: "PR Summarization", icon: MessageSquare },
                  { title: "Line-by-line review", icon: FileCode },
                  { title: "Runs on each commit", icon: GitBranch },
                  { title: "In-thread bot chat", icon: Brain },
                ].map((feat, i) => (
                  <div key={i} className="space-y-3 group">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto transition-all group-hover:bg-primary/15">
                      <feat.icon className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <p className="text-xs font-medium text-foreground">{feat.title}</p>
                  </div>
                ))}
              </div>

              <div className="max-w-lg mx-auto">
                <div className="rounded-xl border border-border bg-code-bg overflow-hidden text-left">
                  <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/30" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/30" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/30" />
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground">github-action.yml</span>
                  </div>
                  <div className="p-5 font-mono text-xs leading-relaxed">
                    <div className="flex gap-4">
                      <span className="text-muted-foreground/40 select-none">1</span>
                      <span><span className="text-primary">- name:</span> VexReview - AI Reviewer</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-muted-foreground/40 select-none">2</span>
                      <span>&nbsp;&nbsp;<span className="text-primary">uses:</span> SUBHAZIT/VEXREVIEW@CODE-REVIEW</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                <a
                  href="https://github.com/marketplace/actions/vexreview-ai-based-pr-reviewer-summarizer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-11 px-6 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all flex items-center"
                >
                  View on Marketplace <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <span className="text-xs font-medium text-muted-foreground">MIT Open Source</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16 space-y-3">
            <span className="pill-badge mx-auto text-primary bg-primary/5 border-primary/20">✦ Process</span>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-[-0.02em]">Simple by design</h2>
            <p className="text-muted-foreground text-base">Pick a repository, index it, and start chatting. That's it.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                id: 1,
                title: "Choose your codebase",
                desc: "Public or private repositories, monorepos, or small scripts. We handle them all.",
                icon: Github
              },
              {
                id: 2,
                title: "AI Analysis",
                desc: "The engine maps dependencies, generates embeddings, and understands the 'why' behind your code.",
                icon: Brain
              },
              {
                id: 3,
                title: "Instant Insights",
                desc: "Ask anything. Get precise file references, line-by-line debugging, and security audits.",
                icon: MessageSquare
              },
              {
                id: 4,
                title: "Dependency Mapping",
                desc: "Deeply understand connections between different modules, functions, and files.",
                icon: GitBranch
              },
              {
                id: 5,
                title: "Visual Intelligence",
                desc: "Generate interactive architecture graphs and see how your system breathes.",
                icon: BarChart3
              },
              {
                id: 6,
                title: "Onboarding Docs",
                desc: "Create comprehensive guides for any sub-module or feature instantly.",
                icon: FileCode
              }
            ].map((step, i) => (
              <div key={i} className="soft-card p-8 flex flex-col gap-6 group hover:border-primary/30 transition-all">
                <div className="space-y-4">
                  <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:border-primary/30 transition-all">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-display text-base font-semibold tracking-tight text-foreground">{step.id}. {step.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section id="features" className="relative py-24 border-t border-border overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16 space-y-3">
            <span className="pill-badge mx-auto text-primary bg-primary/5 border-primary/20">✦ Features</span>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-[-0.02em]">Everything you need to understand code</h2>
            <p className="text-muted-foreground text-base max-w-xl mx-auto">From onboarding to debugging to security — one tool that replaces hours of manual code reading.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (i % 3) * 0.06 }}
                className="soft-card group p-8 flex flex-col gap-5 hover:border-primary/30 transition-all cursor-default"
              >
                <div className="w-11 h-11 rounded-xl bg-muted border border-border flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:border-primary/30 transition-all">
                  <f.icon className="h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <Button size="lg" onClick={() => handleIndex()} className="h-12 px-8 rounded-full bg-foreground text-background font-semibold text-sm hover:opacity-90 transition-all">
              Explore all features <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Bottom CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto rounded-3xl bg-foreground text-background p-10 sm:p-16 relative overflow-hidden">
          <div className="radial-glow w-[500px] h-[500px] -right-32 -bottom-32 opacity-70" />
          <div className="relative z-10 max-w-xl space-y-6 text-center sm:text-left">
            <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-[-0.02em] leading-tight">
              Ready to master your codebase?
            </h2>
            <p className="text-base opacity-70">
              Join 10,000+ developers using AI to decode complex software systems.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-3">
              <Button size="lg" onClick={() => handleIndex()} className="h-12 px-8 rounded-full bg-background text-foreground font-semibold text-sm hover:opacity-90 transition-all">
                Get started free <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={() => navigate("/our-philosophy")}
                className="h-12 px-8 rounded-full border border-background/20 text-background font-semibold text-sm hover:bg-background/10"
              >
                Our philosophy
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-border">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <span className="font-display text-sm font-bold text-foreground">GitPlus</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
                AI-powered codebase intelligence. Understand, debug, and secure any repository in minutes.
              </p>
            </div>

            {/* Product */}
            <div>
              <p className="text-xs font-semibold text-foreground mb-3">Product</p>
              <ul className="space-y-2.5">
                <li><Link to="/features" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Features</Link></li>
                <li><Link to="/how-it-works" className="text-xs text-muted-foreground hover:text-foreground transition-colors">How it works</Link></li>
                <li><Link to="/faq" className="text-xs text-muted-foreground hover:text-foreground transition-colors">FAQ</Link></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <p className="text-xs font-semibold text-foreground mb-3">Resources</p>
              <ul className="space-y-2.5">
                <li><a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors">GitHub</a></li>
                <li><Link to="/docs" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Documentation</Link></li>
                <li><Link to="/changelog" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Changelog</Link></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <p className="text-xs font-semibold text-foreground mb-3">Legal</p>
              <ul className="space-y-2.5">
                <li><Link to="/privacy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link></li>
                <li><Link to="/terms" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link></li>
                <li><Link to="/contact" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Contact</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              A product of GitPlus
            </p>
            <p className="text-xs text-muted-foreground">
              © 2026 GitPlus. Built for developers.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );

  return (
    <>
      {content}
      <LoginWall open={showLoginWall} onOpenChange={setShowLoginWall} />
      <LoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} />
    </>
  );
};

export default Landing;
