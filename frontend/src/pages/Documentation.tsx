import React from "react";
import PageLayout from "@/components/layout/PageLayout";
import { Book, Code, Terminal, Zap, BookOpen, Layers, Shield, Cpu, HelpCircle, Search, Plus, Minus } from "lucide-react";
import { motion } from "framer-motion";

export default function Documentation() {
  const sections = [
    {
      title: "Core Infrastructure",
      items: [
        { icon: <Cpu className="h-4 w-4" />, label: "Indexing Logic" },
        { icon: <Layers className="h-4 w-4" />, label: "Vector Embeddings" },
        { icon: <Code className="h-4 w-4" />, label: "Language Support" }
      ]
    },
    {
      title: "Security & Auditing",
      items: [
        { icon: <Shield className="h-4 w-4" />, label: "Secret Detection" },
        { icon: <Zap className="h-4 w-4" />, label: "Vulnerability Scan" }
      ]
    }
  ];

  return (
    <PageLayout 
      category="Technical Docs"
      title="The Unified Framework" 
      subtitle="Deep dive into the architecture, vector engines, and operational layers that drive GitPlus."
    >
      <div className="grid lg:grid-cols-12 gap-16">
        {/* Navigation Sidebar */}
        <aside className="lg:col-span-3 space-y-12 relative">
           <div className="absolute -left-8 top-0 bottom-0 w-px bg-border/40 hidden lg:block" />
           {sections.map((s, i) => (
             <div key={s.title} className="space-y-6">
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-teal-400/50">{s.title}</h4>
                <ul className="space-y-4">
                  {s.items.map((item, ii) => (
                    <li key={item.label} className="group flex items-center gap-3 text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer transition-all uppercase tracking-widest pl-2 border-l border-transparent hover:border-teal-500/40">
                       <span className="text-teal-400/50 group-hover:text-teal-400 transition-colors">{item.icon}</span>
                       {item.label}
                    </li>
                  ))}
                </ul>
             </div>
           ))}
        </aside>
        
        <div className="lg:col-span-9 space-y-24">
          <section>
             <div className="flex items-center gap-4 text-foreground mb-8 group">
                <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 group-hover:scale-110 transition-transform">
                  <BookOpen className="h-6 w-6 text-teal-400" />
                </div>
                <h2 className="m-0 text-3xl lg:text-4xl font-serif italic">System Architecture</h2>
             </div>
             <p className="text-lg font-medium italic mb-12 border-l-2 border-teal-500/30 pl-8 text-muted-foreground leading-relaxed">
                GitPlus is built on a distributed indexing engine that treats repositories as coherent biological systems rather than collections of text files.
             </p>
             
             <div className="prose prose-invert max-w-none text-muted-foreground leading-relaxed italic font-medium">
               <p>
                Our platform leverages the distributed vectorization of source code. When you input a repository URL, the system initiates a multi-stage ingestion pipeline designed for speed, security, and semantic depth.
               </p>
             </div>
             
             <div className="grid sm:grid-cols-2 gap-6 my-16">
                <div className="p-10 rounded-[2rem] bg-card/40 border border-border/40 space-y-4 relative overflow-hidden group">
                   <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-teal-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                   <h4 className="m-0 text-foreground font-serif italic text-lg opacity-90">Global Context Awareness</h4>
                   <p className="text-sm m-0 text-muted-foreground italic leading-relaxed">Unlike traditional search tools, we maintain a global understanding of cross-file dependencies and module boundaries.</p>
                </div>
                <div className="p-10 rounded-[2rem] bg-card/40 border border-border/40 space-y-4 relative overflow-hidden group">
                   <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-teal-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                   <h4 className="m-0 text-foreground font-serif italic text-lg opacity-90">Semantic Tokenization</h4>
                   <p className="text-sm m-0 text-muted-foreground italic leading-relaxed">We use sophisticated AST parsers to understand the intent and structure of your logic before it ever reaches the LLM.</p>
                </div>
             </div>
          </section>

          <section>
             <div className="flex items-center gap-4 text-foreground mb-8 group">
                <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 group-hover:scale-110 transition-transform">
                  <Terminal className="h-6 w-6 text-teal-400" />
                </div>
                <h2 className="m-0 text-3xl lg:text-4xl font-serif italic">Workspace & Repository Indexing</h2>
             </div>
             <p className="text-muted-foreground italic font-medium leading-relaxed mb-8">
                Configure your repository access tokens and settings for optimal indexing performance.
             </p>
             
             <div className="relative group">
                <div className="absolute inset-0 bg-teal-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-20 transition-opacity" />
                <pre className="relative p-10 rounded-2xl border border-border/40 bg-card font-mono text-sm leading-relaxed overflow-x-auto shadow-xl">
                   <div className="absolute top-4 right-6 text-[9px] font-black tracking-widest text-teal-400/60 uppercase font-mono">Web Indexer / Environment</div>
                   <div className="space-y-2">
                      <span className="text-muted-foreground/60 italic"># Step 1: Input target repository URL in GitPlus dashboard</span><br/>
                      <span className="text-teal-400 uppercase text-[10px] tracking-widest mr-3">WEB</span> <span className="text-foreground">https://github.com/org/repository-name</span><br/><br/>
                      <span className="text-muted-foreground/60 italic"># Step 2: (Optional) Set GitHub Personal Access Token for private repos</span><br/>
                      <span className="text-teal-400 uppercase text-[10px] tracking-widest mr-3">AUTH</span> <span className="text-foreground">ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx</span><br/><br/>
                      <span className="text-muted-foreground/60 italic"># Step 3: Trigger real-time AST chunking & vector search</span><br/>
                      <span className="text-teal-400 uppercase text-[10px] tracking-widest mr-3">SYNC</span> <span className="text-foreground">gitplus --index-mode full</span>
                   </div>
                </pre>
             </div>
          </section>

          <div className="mt-20 p-16 rounded-[3rem] border border-border/40 bg-card/20 relative group overflow-hidden text-center space-y-8">
             <div className="absolute inset-0 blueprint-grid opacity-10" />
             <div className="teal-glow w-[400px] h-[400px] -bottom-24 left-1/2 -translate-x-1/2 opacity-5" />
             
             <div className="relative space-y-6">
                <h3 className="m-0 text-3xl font-serif italic text-foreground leading-tight">Need specialized technical guidance?</h3>
                <p className="text-lg text-muted-foreground max-w-xl mx-auto italic font-medium leading-relaxed">Learn how to integrate GitPlus into your team's workflow and developer setup.</p>
                <div className="pt-4">
                  <button className="px-12 py-5 rounded-2xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.3em] shadow-lg hover:bg-primary/90 transition-all">Explore Platform Capabilities</button>
                </div>
             </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
