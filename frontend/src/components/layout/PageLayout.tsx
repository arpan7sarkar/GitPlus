import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import AppHeader from "@/components/layout/AppHeader";
import { useCompactMode } from "@/hooks/use-compact-mode";
import { cn } from "@/lib/utils";

interface PageLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  category?: string;
}

export default function PageLayout({ title, subtitle, children, category }: PageLayoutProps) {
  const compact = useCompactMode();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader />
      <main id="main-content" tabIndex={-1} className={cn("mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6", compact ? "py-5" : "py-8 sm:py-10")}>
        <header className="mb-6 max-w-3xl">
          {category && <p className="mb-2 text-sm font-medium text-muted-foreground">{category}</p>}
          <h1 className="text-[clamp(1.5rem,2vw,1.75rem)] font-semibold leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-[15px] leading-relaxed text-secondary-foreground">{subtitle}</p>}
        </header>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
          {children}
        </motion.div>
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 text-sm text-muted-foreground sm:px-6">
          <span>GitPlus · Codebase workspace</span>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-3">
            <Link to="/docs" className="hover:text-foreground">Documentation</Link>
            <Link to="/changelog" className="hover:text-foreground">Changelog</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/contact" className="hover:text-foreground">Contact</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
