import Link from "next/link";
import { Code2 } from "lucide-react";
import { GithubIcon, TwitterIcon } from "@/components/shared/icons";

const FOOTER_LINKS = {
  Product: [
    { label: "Features",     href: "/features" },
    { label: "How It Works", href: "/how-it-works" },
    { label: "CLI",          href: "/cli" },
    { label: "SDK",          href: "/sdk" },
    { label: "Changelog",    href: "/changelog" },
  ],
  Resources: [
    { label: "Documentation", href: "/docs" },
    { label: "FAQ",           href: "/faq" },
    { label: "Our Philosophy", href: "/our-philosophy" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Contact",        href: "/contact" },
  ],
};

export function SiteFooter() {
  return (
    <footer className="border-t border-[#E5E5E3] bg-[#FAFAFA]">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4338CA] to-[#6366F1] flex items-center justify-center">
                <Code2 className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-sm text-[#111114]">CodebaseGPT</span>
            </Link>
            <p className="text-sm text-[#5B5F66] leading-relaxed mb-5 max-w-[220px]">
              AI-powered codebase intelligence for every developer.
            </p>
            <div className="flex gap-3">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer"
                className="p-2 rounded-lg border border-[#E5E5E3] text-[#5B5F66] hover:text-[#111114] hover:border-[#111114] transition-colors">
                <GithubIcon className="h-4 w-4" />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer"
                className="p-2 rounded-lg border border-[#E5E5E3] text-[#5B5F66] hover:text-[#111114] hover:border-[#111114] transition-colors">
                <TwitterIcon className="h-4 w-4" />
              </a>
            </div>
          </div>

          {Object.entries(FOOTER_LINKS).map(([section, links]) => (
            <div key={section}>
              <h4 className="text-xs font-semibold text-[#111114] uppercase tracking-wider mb-4">{section}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-[#5B5F66] hover:text-[#111114] transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-[#E5E5E3] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[#5B5F66]">
            © {new Date().getFullYear()} CodebaseGPT. All rights reserved.
          </p>
          <p className="text-xs text-[#5B5F66]">
            Built for developers who move fast.
          </p>
        </div>
      </div>
    </footer>
  );
}
