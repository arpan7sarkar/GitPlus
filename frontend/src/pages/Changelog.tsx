import React from "react";
import PageLayout from "@/components/layout/PageLayout";
import { Calendar, Sparkles, Rocket, Bug } from "lucide-react";
import { motion } from "framer-motion";
import { CHANGELOG_DATA } from "@/lib/changelog-data";

export default function Changelog() {
  return (
    <PageLayout category="Signals" title="Platform Evolution" subtitle="Tracking every milestone in the development of the world's most advanced codebase intelligence engine.">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="text-[13px] font-medium text-secondary-foreground">Recorded platform changes</div>
          <div className="hidden rounded-full border border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground md:block">Release notes</div>
        </div>
        <div className="space-y-8">
          {CHANGELOG_DATA.map((update, i) => (
            <motion.div key={update.version} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="relative pl-10 sm:pl-14">
              {i < CHANGELOG_DATA.length - 1 && <div aria-hidden="true" className="absolute bottom-[-32px] left-3.5 top-2 w-px bg-border sm:left-4" />}
              <div aria-hidden="true" className="absolute left-0 top-0 z-10 flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card p-1.5 sm:h-8 sm:w-8">
                {update.type === "Major Update" ? <Rocket className="h-4 w-4 text-secondary-foreground" /> : <Bug className="h-4 w-4 text-secondary-foreground" />}
              </div>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="m-0 text-xl font-semibold text-foreground">{update.version}</h2>
                  {update.isLatest && <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Current Node</div>}
                  <div className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">{update.type}</div>
                  <div className="flex items-center gap-2 text-[13px] text-muted-foreground"><Calendar aria-hidden="true" className="h-3.5 w-3.5" />{update.date}</div>
                </div>
                <div className="rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-muted/40 sm:p-6">
                  <ul className="m-0 grid list-none gap-4 p-0">
                    {update.changes.map((change, ci) => (
                      <li key={ci} className="flex items-start gap-3 text-secondary-foreground">
                        <div aria-hidden="true" className="mt-2.5 h-px w-3 shrink-0 bg-border" />
                        <p className="m-0 text-[15px] leading-relaxed">{change}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="mt-10 space-y-5 rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
          <h2 className="flex items-center justify-center gap-3 text-xl font-semibold text-foreground"><Sparkles aria-hidden="true" className="h-5 w-5 shrink-0 text-secondary-foreground" />What's arriving next?</h2>
          <p className="mx-auto max-w-xl text-[15px] leading-relaxed text-secondary-foreground">Our R&D team is currently focused on <strong className="font-medium text-foreground">Multimodal Neural Debugging</strong> and automated code-to-speech documentation generation.</p>
          <div className="pt-2"><button className="min-h-11 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-10">Development Roadmap</button></div>
        </div>
      </div>
    </PageLayout>
  );
}
