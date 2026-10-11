import React from "react";
import PageLayout from "@/components/layout/PageLayout";
import { Shield } from "lucide-react";

export default function Terms() {
  return (
    <PageLayout category="Agreement" title="Terms of Interaction" subtitle="Operational guidelines for the use of the GitPlus Intelligence Network.">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-8">
          <div className="mb-8 flex flex-wrap gap-x-8 gap-y-4 border-b border-border pb-6">
            <div className="space-y-1"><p className="text-xs text-muted-foreground">Document Type</p><p className="font-mono text-[13px] text-secondary-foreground">Service Level Agreement</p></div>
            <div className="space-y-1"><p className="text-xs text-muted-foreground">Version</p><p className="font-mono text-[13px] text-secondary-foreground">V.2.4.0 (Unified)</p></div>
            <div className="space-y-1"><p className="text-xs text-muted-foreground">Authority</p><p className="font-mono text-[13px] text-primary">Verified Origin</p></div>
          </div>
          <div className="space-y-8">
            <section className="space-y-4">
              <h2 className="m-0 text-xl font-semibold text-foreground">1. Usage Licensing</h2>
              <p className="text-[15px] leading-relaxed text-secondary-foreground">GitPlus grants you a non-exclusive, non-transferable license to utilize our neural indexing nodes for the purpose of source code analysis and knowledge retrieval.</p>
            </section>
            <section className="space-y-4">
              <h2 className="m-0 text-xl font-semibold text-foreground">2. Operational Boundaries</h2>
              <p className="text-[15px] leading-relaxed text-secondary-foreground">You agree not to use the platform for the analysis of encrypted malware or illegal cryptographic protocols. Violation of these boundaries results in immediate node termination.</p>
            </section>
            <section className="space-y-4">
              <h2 className="m-0 text-xl font-semibold text-foreground">3. System Uptime Index</h2>
              <p className="text-[15px] leading-relaxed text-secondary-foreground">We strive for 99.9% uptime on our indexing cores. Maintenance windows for neural model upgrades will be broadcast via the control terminal 24 hours in advance.</p>
            </section>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
            <div className="flex items-center gap-2"><Shield aria-hidden="true" className="h-4 w-4 text-secondary-foreground" /><span className="text-xs text-muted-foreground">GitPlus Legal Auth</span></div>
            <div className="break-words font-mono text-xs text-muted-foreground">VERIFIED: SLA-APPROVED</div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
