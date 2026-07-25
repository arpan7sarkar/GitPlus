"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";

interface TestimonialCardProps {
  quote: string;
  author: string;
  role: string;
  company: string;
  rating?: number;
  index?: number;
}

export function TestimonialCard({ quote, author, role, company, rating = 5, index = 0 }: TestimonialCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -4, boxShadow: "0 12px 40px rgba(0,0,0,0.08)" }}
      className="bg-white rounded-2xl border border-[#E5E5E3] p-7 flex flex-col gap-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow"
    >
      <div className="flex gap-0.5">
        {Array.from({ length: rating }).map((_, i) => (
          <Star key={i} className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" />
        ))}
      </div>
      <p className="text-[#374151] text-sm leading-relaxed flex-1">&ldquo;{quote}&rdquo;</p>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#4338CA] to-[#6366F1] flex items-center justify-center text-white text-sm font-bold">
          {author[0]}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#111114]">{author}</p>
          <p className="text-[11px] text-[#5B5F66]">{role} · {company}</p>
        </div>
      </div>
    </motion.div>
  );
}
