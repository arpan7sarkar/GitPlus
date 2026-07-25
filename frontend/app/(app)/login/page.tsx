"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Code2 } from "lucide-react";
import { GithubIcon } from "@/components/shared/icons";
import { useAuthStore } from "@/lib/stores/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();

  const handleLogin = () => {
    login();
    router.push("/");
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="card p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#4338CA] to-[#6366F1] flex items-center justify-center mx-auto mb-6 shadow-md">
            <Code2 className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#111114] mb-2">Welcome back</h1>
          <p className="text-sm text-[#5B5F66] mb-8">Sign in to access your indexed repositories and chat history.</p>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-[#111114] text-white font-semibold text-sm hover:bg-[#1E1E22] transition-colors shadow-sm"
          >
            <GithubIcon className="h-5 w-5" />
            Continue with GitHub
          </motion.button>

          <p className="text-[11px] text-[#C5C5C3] mt-6 leading-relaxed">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
