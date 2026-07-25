"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Lock, ArrowRight, X } from "lucide-react";
import { GithubIcon } from "@/components/shared/icons";

interface LoginWallProps {
  open: boolean;
  onClose: () => void;
}

export function LoginWall({ open, onClose }: LoginWallProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm px-4"
          >
            <div className="bg-white rounded-2xl shadow-lg border border-[#E5E5E3] p-8 text-center relative">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-[#C5C5C3] hover:text-[#5B5F66] hover:bg-[#F5F5F4] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#4338CA] to-[#6366F1] flex items-center justify-center mx-auto mb-5 shadow-md">
                <Lock className="h-6 w-6 text-white" />
              </div>

              <h2 className="text-xl font-bold text-[#111114] mb-2">
                Free limit reached
              </h2>
              <p className="text-sm text-[#5B5F66] mb-6 leading-relaxed">
                You've analyzed 5 repositories as a guest.
                Sign in with GitHub to unlock <strong className="text-[#111114]">unlimited access</strong>.
              </p>

              <Link
                href="/login"
                onClick={onClose}
                className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-[#111114] text-white font-semibold text-sm hover:bg-[#1E1E22] transition-colors shadow-sm"
              >
                <GithubIcon className="h-5 w-5" />
                Continue with GitHub
              </Link>

              <p className="text-[11px] text-[#C5C5C3] mt-5">
                No credit card required · Free for open source
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
