import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "CodebaseGPT — AI Codebase Intelligence",
    template: "%s | CodebaseGPT",
  },
  description:
    "Understand any GitHub repository in seconds. AI-powered code chat, security scanning, architecture visualization, and onboarding docs.",
  keywords: ["code analysis", "AI", "GitHub", "codebase", "developer tools"],
  openGraph: {
    title: "CodebaseGPT — AI Codebase Intelligence",
    description: "Understand any GitHub repository in seconds.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${spaceGrotesk.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
