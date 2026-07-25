"use client";

import { Eye, Database, Lock, RotateCcw, Save } from "lucide-react";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/shared/page-transition";
import { useSettingsStore } from "@/lib/stores/settings-store";

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      className={`relative w-10 h-6 rounded-full transition-colors ${checked ? "bg-[#4338CA]" : "bg-[#E5E5E3]"} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <motion.div
        animate={{ x: checked ? 18 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
      />
    </button>
  );
}

export default function SettingsPage() {
  const { settings, setSetting, resetDefaults } = useSettingsStore();

  const handleSave = () => {
    // Settings auto-persist via Zustand
    alert("Settings saved!");
  };

  const handleClearTokens = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("github_pat");
      alert("Tokens cleared.");
    }
  };

  const sections = [
    {
      title: "Appearance",
      icon: Eye,
      items: [
        { label: "Compact Mode", desc: "Optimize UI for smaller screens.", key: "compactMode" as const, value: settings.compactMode },
        { label: "Reduced Motion", desc: "Minimize animations throughout.", key: "reducedMotion" as const, value: settings.reducedMotion },
      ],
    },
    {
      title: "Indexing & Storage",
      icon: Database,
      items: [
        { label: "Cache Index Data", desc: "Store metadata locally for faster reloading.", key: "cacheIndexData" as const, value: settings.cacheIndexData },
        { label: "Auto-save Chat History", desc: "Persist AI conversations across sessions.", key: "autoSaveChatHistory" as const, value: settings.autoSaveChatHistory },
      ],
    },
  ];

  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-[#111114] mb-2">Settings</h1>
        <p className="text-sm text-[#5B5F66] mb-8">Customize your experience and manage preferences.</p>

        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.title} className="card p-6">
              <div className="flex items-center gap-2 mb-5">
                <section.icon className="h-5 w-5 text-[#4338CA]" />
                <h3 className="text-base font-semibold text-[#111114]">{section.title}</h3>
              </div>
              <div className="space-y-5">
                {section.items.map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#111114]">{item.label}</p>
                      <p className="text-xs text-[#5B5F66]">{item.desc}</p>
                    </div>
                    <Toggle checked={item.value} onChange={(v) => setSetting(item.key, v)} />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Security */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-5">
              <Lock className="h-5 w-5 text-[#4338CA]" />
              <h3 className="text-base font-semibold text-[#111114]">Security</h3>
            </div>
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#111114]">Strict HTTPS Only</p>
                  <p className="text-xs text-[#5B5F66]">Enforce secure connections for all API requests.</p>
                </div>
                <Toggle checked={settings.strictHttps} onChange={() => {}} disabled />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#111114]">Personal Access Tokens</p>
                  <p className="text-xs text-[#5B5F66]">Clear stored GitHub tokens from localStorage.</p>
                </div>
                <button onClick={handleClearTokens} className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200">
                  Clear Tokens
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={resetDefaults}
            className="px-5 py-2.5 rounded-xl border border-[#E5E5E3] text-sm font-medium text-[#5B5F66] hover:bg-[#F5F5F4] flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" /> Reset Defaults
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#4338CA] to-[#6366F1] text-sm font-semibold text-white shadow-sm hover:shadow-md flex items-center gap-2"
          >
            <Save className="h-4 w-4" /> Save Changes
          </motion.button>
        </div>
      </div>
    </PageTransition>
  );
}
