import React from "react";
import PageLayout from "@/components/layout/PageLayout";
import { HelpCircle, Search } from "lucide-react";
import { motion } from "framer-motion";

export default function FAQ() {
  const faqs = [
    {
      category: "Platform Access",
      questions: [
        { q: "What are the repository indexing limits?", a: "Guests can start up to five analyses before sign-in is required. Access to a private repository depends on the permissions of your GitHub account or personal access token." },
        { q: "How do I connect my private GitHub repositories?", a: "Simply sign in with your GitHub account. We use secure OAuth 2.0 scopes (`repo` and `read:user`) to list and clone your private projects for analysis. We never see your password." }
      ]
    },
    {
      category: "Technology & AI",
      questions: [
        { q: "Which AI model powers GitPlus?", a: "The AI model is configured by the deployment. Model availability and context limits depend on that configuration." },
        { q: "Does it support monorepos or complex structures?", a: "Yes. Our structural tokenization engine can navigate complex monorepo patterns, identifying boundaries between packages and mapping internal dependencies across workspace links." }
      ]
    },
    {
      category: "Security & Privacy",
      questions: [
        { q: "Is my code stored on your servers?", a: "Repository text may be stored for search and sent to external AI providers. Only connect code you are allowed to share. This interface does not guarantee zero retention." },
        { q: "Does the AI learn from my private data?", a: "Data handling depends on the configured AI provider and deployment. Review the provider's retention and training policies before connecting private code; GitPlus cannot establish those guarantees from this interface." }
      ]
    }
  ];

  return (
    <PageLayout category="Support" title="Common Enquiries" subtitle="Detailed answers to technical, security, and billing questions from the GitPlus community.">
      <div className="mx-auto max-w-5xl">
        <div className="relative mx-auto mb-8 max-w-2xl">
          <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
            <Search aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
          </div>
          <input type="text" disabled aria-label="Search the technical manual (unavailable)" placeholder="Search the technical manual..." className="h-11 w-full rounded-xl border border-border bg-muted pl-12 pr-4 text-sm text-secondary-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed" />
        </div>

        <div className="grid gap-8">
          {faqs.map((group) => (
            <div key={group.category} className="space-y-5">
              <div className="flex items-center gap-4">
                <h2 className="shrink-0 text-xl font-semibold text-foreground">{group.category}</h2>
                <div aria-hidden="true" className="h-px w-full bg-border" />
              </div>
              <div className="grid gap-4">
                {group.questions.map((faq, i) => (
                  <motion.div key={faq.q} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} viewport={{ once: true }} className="rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-muted/40 sm:p-6">
                    <div className="flex items-start gap-4 sm:gap-5">
                      <div aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted">
                        <HelpCircle className="h-5 w-5 text-secondary-foreground" />
                      </div>
                      <div className="min-w-0 space-y-3">
                        <h3 className="text-lg font-medium leading-snug text-foreground">{faq.q}</h3>
                        <p className="max-w-3xl text-[15px] leading-relaxed text-secondary-foreground">{faq.a}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 space-y-5 rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
          <h2 className="text-xl font-semibold text-foreground">Still need clarification?</h2>
          <p className="mx-auto max-w-md text-[15px] leading-relaxed text-secondary-foreground">Our technical engineers are available for specialized consultations for enterprise customers.</p>
          <div className="pt-2">
            <button className="min-h-11 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-10">Contact Tech Support</button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
