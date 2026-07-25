"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Code2, Menu, X, ArrowRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Features", href: "/features", hasDropdown: false },
  { label: "Docs", href: "/docs", hasDropdown: false },
  { label: "FAQ", href: "/faq", hasDropdown: false },
  { label: "Privacy", href: "/privacy", hasDropdown: false },
  { label: "Terms", href: "/terms", hasDropdown: false },
];


export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="sticky top-4 z-50 px-4 sm:px-6 pointer-events-none mb-[-64px]">
      <header className="max-w-5xl mx-auto rounded-full bg-white/90 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.12)] px-5 sm:px-6 py-2.5 flex items-center justify-between pointer-events-auto transition-all">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-full bg-[#0F172A] flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
            <Code2 className="h-4 w-4 text-white" />
          </div>
          <span className="font-extrabold text-base tracking-tight text-[#0F172A] group-hover:text-[#0284C7] transition-colors">
            CodebaseGPT
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <div key={link.label} className="relative group">
              <Link
                href={link.href}
                className={cn(
                  "flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors",
                  pathname === link.href
                    ? "text-[#0284C7] bg-[#F0F9FF]"
                    : "text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9]"
                )}
              >
                <span>{link.label}</span>
                {link.hasDropdown && (
                  <ChevronDown className="h-3 w-3 text-[#94A3B8] group-hover:text-[#475569] transition-transform group-hover:rotate-180" />
                )}
              </Link>
            </div>
          ))}
        </nav>

        {/* Right Action Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
          >
            Log in
          </Link>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link
              href="/"
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[#0F172A] text-white shadow-md hover:bg-[#1E293B] transition-all"
            >
              <span>Get started</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          className="md:hidden p-2 rounded-full text-[#475569] hover:bg-[#F1F5F9] transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0, scale: 0.95 }}
            animate={{ height: "auto", opacity: 1, scale: 1 }}
            exit={{ height: 0, opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="md:hidden max-w-5xl mx-auto mt-2 rounded-3xl overflow-hidden border border-white/60 bg-white/95 backdrop-blur-xl shadow-xl pointer-events-auto"
          >
            <div className="px-6 py-4 space-y-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "block px-4 py-3 rounded-2xl text-sm font-medium transition-colors",
                    pathname === link.href
                      ? "text-[#0284C7] bg-[#F0F9FF]"
                      : "text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9]"
                  )}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-3 flex flex-col gap-2">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="w-full text-center px-4 py-2.5 rounded-full border border-[#E2E8F0] text-sm font-medium text-[#334155]"
                >
                  Log in
                </Link>
                <Link
                  href="/"
                  onClick={() => setMobileOpen(false)}
                  className="w-full text-center px-4 py-2.5 rounded-full bg-[#0F172A] text-sm font-bold text-white shadow-sm"
                >
                  Get started →
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
