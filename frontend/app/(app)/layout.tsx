"use client";

import { AppShell } from "@/components/app/app-shell";
import { KeepAliveStatus } from "@/components/shared/keep-alive-status";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      {children}
      <KeepAliveStatus />
    </AppShell>
  );
}
