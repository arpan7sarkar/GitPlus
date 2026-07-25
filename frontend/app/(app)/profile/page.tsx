"use client";

import { motion } from "framer-motion";
import { User, Mail, Calendar, Shield } from "lucide-react";
import { GithubIcon } from "@/components/shared/icons";
import { PageTransition } from "@/components/shared/page-transition";
import { useAuthStore } from "@/lib/stores/auth-store";

export default function ProfilePage() {
  const { user } = useAuthStore();

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-[#5B5F66]">Please log in to view your profile.</p>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-[#111114] mb-8">Profile</h1>
        <div className="grid md:grid-cols-3 gap-6">
          {/* Avatar card */}
          <div className="card p-8 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#4338CA] to-[#6366F1] flex items-center justify-center text-white text-2xl font-bold mb-4 shadow-md">
              {user.name[0]}
            </div>
            <h3 className="text-lg font-semibold text-[#111114]">{user.name}</h3>
            <p className="text-xs text-[#5B5F66] mt-1">@{user.username}</p>
            <div className="mt-6 space-y-3 w-full">
              <div className="flex items-center gap-2 text-xs text-[#5B5F66]">
                <Shield className="h-4 w-4 text-emerald-500" /> Authenticated
              </div>
              <div className="flex items-center gap-2 text-xs text-[#5B5F66]">
                <Calendar className="h-4 w-4 text-[#4338CA]" /> Joined {new Date(user.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="md:col-span-2 card p-8 space-y-6">
            <h4 className="text-xs font-semibold text-[#4338CA] uppercase tracking-wider">Account Details</h4>
            <div className="grid gap-5">
              {[
                { label: "Full Name", value: user.name, icon: User },
                { label: "Email", value: user.email, icon: Mail },
                { label: "GitHub", value: `github.com/${user.username}`, icon: GithubIcon },
              ].map(f => (
                <div key={f.label}>
                  <label className="text-[10px] uppercase tracking-wider text-[#5B5F66] block mb-1.5">{f.label}</label>
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#F5F5F4] border border-[#E5E5E3] text-sm font-medium text-[#111114]">
                    <f.icon className="h-4 w-4 text-[#5B5F66]" />
                    {f.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-[#E5E5E3]">
              <h4 className="text-xs font-semibold text-[#4338CA] uppercase tracking-wider mb-4">Connected Accounts</h4>
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#F5F5F4] border border-[#E5E5E3]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#111114] flex items-center justify-center"><GithubIcon className="h-5 w-5 text-white" /></div>
                  <div><p className="text-sm font-medium text-[#111114]">GitHub</p><p className="text-[10px] text-[#5B5F66]">Primary Authentication</p></div>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider border border-emerald-200">Connected</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
