"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { useToastStore } from "@/lib/hooks/use-toast";

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const COLORS = {
  success: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", icon: "text-emerald-500" },
  error: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", icon: "text-red-500" },
  info: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", icon: "text-blue-500" },
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = ICONS[toast.type];
          const color = COLORS[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={`${color.bg} ${color.border} border rounded-xl px-4 py-3 shadow-lg flex items-start gap-3 min-w-[280px]`}
            >
              <Icon className={`h-4 w-4 ${color.icon} mt-0.5 shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${color.text}`}>{toast.title}</p>
                {toast.description && (
                  <p className={`text-xs ${color.text} opacity-80 mt-0.5`}>{toast.description}</p>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className={`p-0.5 rounded ${color.text} opacity-50 hover:opacity-100 transition-opacity shrink-0`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
