import { Metadata } from "next";
import { MessageSquare, Shield, Network, FileText, Search, Zap, GitBranch, Eye } from "lucide-react";

export const metadata: Metadata = {
  title: "Features",
  description: "Explore CodebaseGPT's AI-powered features for codebase understanding.",
};

const FEATURES = [
  {
    icon: MessageSquare,
    title: "AI Code Chat",
    description: "Ask questions about any codebase and get answers with exact file citations and line-level references.",
    gradient: "from-blue-500 to-indigo-600",
  },
  {
    icon: Shield,
    title: "Security Scanner",
    description: "Automated 12-point security audit covering secrets, XSS, SQL injection, CORS misconfigurations, and more.",
    gradient: "from-red-500 to-rose-600",
  },
  {
    icon: Network,
    title: "System Design Docs",
    description: "AI-generated architecture documents with component diagrams and data flow analysis.",
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    icon: FileText,
    title: "Onboarding Guides",
    description: "Auto-generate comprehensive developer onboarding docs with setup instructions and key patterns.",
    gradient: "from-amber-500 to-orange-600",
  },
  {
    icon: Search,
    title: "Semantic Code Search",
    description: "Find code by meaning, not just keywords. Hybrid vector + keyword search across your entire codebase.",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    icon: GitBranch,
    title: "Issue & PR Intelligence",
    description: "AI-powered issue solving, PR code review, and commit explanations with codebase-aware context.",
    gradient: "from-cyan-500 to-blue-600",
  },
  {
    icon: Eye,
    title: "Architecture Visualization",
    description: "Interactive dependency graphs and module relationship maps generated from your codebase.",
    gradient: "from-pink-500 to-rose-600",
  },
  {
    icon: Zap,
    title: "Lightning Indexing",
    description: "Process 100K+ line codebases in under 30 seconds with smart on-demand lazy parsing.",
    gradient: "from-yellow-500 to-amber-600",
  },
];

export default function FeaturesPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-24">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-[#111114] mb-4" style={{ fontFamily: "var(--font-display)" }}>
          Everything you need to understand code
        </h1>
        <p className="text-lg text-[#5B5F66] max-w-2xl mx-auto">
          AI-powered tools that help you navigate, audit, document, and chat with any GitHub repository.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="card p-6 hover:shadow-card-hover transition-all group">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform`}>
              <feature.icon className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-sm font-bold text-[#111114] mb-2">{feature.title}</h3>
            <p className="text-xs text-[#5B5F66] leading-relaxed">{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
