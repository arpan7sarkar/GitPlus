"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface StepperProps {
  steps: string[];
  currentStep: number; // 0-based
  className?: string;
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <div className={cn("flex flex-col gap-0", className)}>
      {steps.map((step, i) => {
        const isCompleted = i < currentStep;
        const isCurrent = i === currentStep;
        const isPending = i > currentStep;

        return (
          <div key={i} className="flex items-start gap-3">
            {/* Vertical connector */}
            <div className="flex flex-col items-center">
              {/* Circle */}
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.15, duration: 0.3 }}
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                  isCompleted && "bg-[#4338CA] border-[#4338CA]",
                  isCurrent && "bg-white border-[#4338CA] shadow-[0_0_0_4px_rgba(99,102,241,0.15)]",
                  isPending && "bg-[#F5F5F4] border-[#E5E5E3]"
                )}
              >
                {isCompleted && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  >
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  </motion.div>
                )}
                {isCurrent && (
                  <Loader2 className="h-3.5 w-3.5 text-[#4338CA] animate-spin" />
                )}
                {isPending && (
                  <span className="text-[10px] font-bold text-[#C5C5C3]">{i + 1}</span>
                )}
              </motion.div>
              {/* Line */}
              {i < steps.length - 1 && (
                <div className={cn(
                  "w-0.5 h-10 transition-colors duration-500",
                  isCompleted ? "bg-[#4338CA]" : "bg-[#E5E5E3]"
                )} />
              )}
            </div>

            {/* Label */}
            <div className="pt-1">
              <p className={cn(
                "text-sm font-medium transition-colors",
                isCompleted && "text-[#4338CA]",
                isCurrent && "text-[#111114]",
                isPending && "text-[#C5C5C3]"
              )}>
                {step}
              </p>
              {isCurrent && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-[#5B5F66] mt-0.5"
                >
                  In progress...
                </motion.p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
