"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

interface CTASectionProps {
  headline?: string;
  sub?: string;
  cta?: string;
}

export function CTASection({
  headline = "Start understanding your codebase today.",
  sub = "Paste any GitHub URL. No setup. No credit card.",
  cta = "Index a Repository",
}: CTASectionProps) {
  return (
    <section className="bg-[#0D0D10] py-24 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="space-y-8"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight">
            {headline.split(" ").map((word, i) =>
              i === 0 ? (
                <span key={i} className="bg-gradient-to-r from-[#6366F1] to-[#818CF8] bg-clip-text text-transparent">
                  {word}{" "}
                </span>
              ) : (
                <span key={i}>{word} </span>
              )
            )}
          </h2>
          <p className="text-lg text-white/60 max-w-xl mx-auto">{sub}</p>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-[#4338CA] to-[#6366F1] text-white font-semibold text-base shadow-[0_0_30px_rgba(99,102,241,0.4)] hover:shadow-[0_0_50px_rgba(99,102,241,0.5)] transition-shadow"
            >
              {cta} <ArrowRight className="h-5 w-5" />
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
