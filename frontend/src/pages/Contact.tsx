import React from "react";
import PageLayout from "@/components/layout/PageLayout";
import { Mail, Github, Twitter, MapPin, Shield, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Contact() {
  const contactOptions = [
    { icon: <Mail className="h-6 w-6" />, label: "Protocol", value: "SUBHAJITPATHAK9900@GMAIL.COM" },
    { icon: <Twitter className="h-6 w-6" />, label: "Signal", value: "@GitPlus" },
    { icon: <Github className="h-6 w-6" />, label: "Repository", value: "GITPLUS" },
    { icon: <MapPin className="h-6 w-6" />, label: "Nexus", value: "KOLKATA, WEST BENGAL, INDIA" },
  ];

  return (
    <PageLayout
      category="Network"
      title="Establish Connection"
      subtitle="Engage with our technical team to explore custom integrations, high-volume indexing, or neural feedback."
    >
      <div className="max-w-5xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-8 items-start font-sans">
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground leading-tight">Contact GitPlus</h2>
              <p className="text-sm text-secondary-foreground leading-relaxed">
                Share questions, integration requests, or feedback using the contact details below.
                Response times are not guaranteed.
              </p>
            </div>

            <div className="grid gap-4">
              {contactOptions.map((opt, i) => (
                <div key={i} className="p-5 rounded-xl border border-border bg-card transition-colors relative overflow-hidden">
                  <div className="flex gap-4 items-center">
                    <div className="h-12 w-12 shrink-0 rounded-lg bg-accent border border-border flex items-center justify-center text-secondary-foreground">
                      {opt.icon}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">{opt.label}</p>
                      <p className="text-sm font-medium text-foreground break-words">{opt.value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-5 rounded-xl border border-border bg-card space-y-3 relative overflow-hidden">
              <div className="relative flex items-center gap-3 text-xs font-medium text-success">
                <Mail className="h-4 w-4" aria-hidden="true" />
                Email contact
              </div>
              <p className="relative text-sm text-secondary-foreground leading-relaxed">
                Use the listed email address to reach the project. Live support availability is not tracked here.
              </p>
            </div>
          </div>

          <div className="relative">
            <div className="relative p-6 rounded-xl border border-border bg-card space-y-6 overflow-hidden">
              <div className="relative space-y-5">
                <div className="space-y-2">
                  <label htmlFor="contact-name" className="text-xs font-medium text-secondary-foreground block">Terminal ID / Name</label>
                  <input
                    id="contact-name"
                    placeholder="ENTER FULL NAME..."
                    className="w-full h-12 bg-background border border-input rounded-lg px-4 text-base sm:text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="contact-email" className="text-xs font-medium text-secondary-foreground block">Ingestion Point / Email</label>
                  <input
                    id="contact-email"
                    placeholder="USER@ORG.DOMAIN"
                    className="w-full h-12 bg-background border border-input rounded-lg px-4 text-base sm:text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="contact-message" className="text-xs font-medium text-secondary-foreground block">Transmission Data / Message</label>
                  <textarea
                    id="contact-message"
                    rows={5}
                    placeholder="INITIATING TRANSMISSION..."
                    className="w-full bg-background border border-input rounded-lg p-4 text-base sm:text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors resize-none"
                  />
                </div>
                <button disabled aria-describedby="contact-form-status" className="w-full h-12 rounded-lg border border-border bg-muted text-muted-foreground text-sm font-medium cursor-not-allowed">
                  Contact form unavailable
                </button>
                <p id="contact-form-status" className="text-sm leading-relaxed text-secondary-foreground">
                  This form is not connected to a messaging service. Use the email address above instead.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
