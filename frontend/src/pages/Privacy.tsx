import React from "react";
import PageLayout from "@/components/layout/PageLayout";
import { Shield } from "lucide-react";

export default function Privacy() {
  return (
    <PageLayout category="Governance" title="Data & Privacy Framework" subtitle="Repository data handling and external AI providers.">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-8">
          <div className="mb-8 flex flex-wrap gap-x-8 gap-y-4 border-b border-border pb-6">
            <div className="space-y-1"><p className="text-xs text-muted-foreground">Scope</p><p className="font-mono text-[13px] text-secondary-foreground">Data handling overview</p></div>
          </div>
          <div className="space-y-8">
            <section className="space-y-4">
              <h2 className="m-0 text-xl font-semibold text-foreground">1. Data Ingestion Protocols</h2>
              <p className="text-[15px] leading-relaxed text-secondary-foreground">Repository text may be stored for search, cached in this browser, and sent to external AI providers. Only connect repositories you are allowed to share.</p>
              <div className="rounded-xl border border-border bg-muted p-4 text-sm leading-relaxed text-secondary-foreground">Retention and transport security depend on the deployment. This interface does not guarantee zero retention or a particular TLS version.</div>
            </section>
            <section className="space-y-4">
              <h2 className="m-0 text-xl font-semibold text-foreground">2. Vector Privacy Limits</h2>
              <p className="text-[15px] leading-relaxed text-secondary-foreground">Search data can include code snippets, embeddings, and repository metadata. Do not assume tenant isolation or a retention policy without verifying the configuration of your deployment.</p>
            </section>
            <section className="space-y-4">
              <h2 className="m-0 text-xl font-semibold text-foreground">3. Third-Party Neural Nodes</h2>
              <p className="text-[15px] leading-relaxed text-secondary-foreground">The deployment chooses which AI providers process repository context. Review those providers' data retention and training policies before sharing private code. This page does not establish provider privacy guarantees.</p>
            </section>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
            <div className="flex items-center gap-2"><Shield aria-hidden="true" className="h-4 w-4 text-secondary-foreground" /><span className="text-xs text-muted-foreground">Review data handling before connecting private code.</span></div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
