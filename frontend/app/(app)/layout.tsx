"use client";

import { AppShell } from "@/components/app/app-shell";
import { KeepAliveStatus } from "@/components/shared/keep-alive-status";
import { ToastContainer } from "@/components/shared/toast";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      {children}
      <KeepAliveStatus />
      <ToastContainer />
    </AppShell>
  );
}
