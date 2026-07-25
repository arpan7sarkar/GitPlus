import type { RepoOverview } from "../api";

export const MOCK_OVERVIEW: RepoOverview = {
  narrative:
    "Next.js is a production-ready React framework maintained by Vercel. The codebase is organized as a Turborepo monorepo with the core logic inside packages/next. It supports both the Pages Router (legacy) and the App Router (React Server Components + Streaming SSR). The build system uses a hybrid of webpack 5 and SWC (Rust-based transpiler) for ultra-fast compilation. Key complexity areas include the app-render pipeline, edge runtime handling, and the multi-zone image optimization system.",
  framework: "Next.js",
  complexity: "Enterprise",
  keyFiles: [
    "packages/next/src/server/app-render/app-render.tsx",
    "packages/next/src/server/next-server.ts",
    "packages/next/src/client/router.ts",
    "packages/next/src/build/webpack-config.ts",
    "packages/next/src/lib/router/utils/route-matcher.ts",
  ],
  mainDeps: [
    "react@18",
    "react-dom@18",
    "@swc/core",
    "webpack@5",
    "turbo",
    "styled-jsx",
    "typescript@5",
    "@vercel/analytics",
    "semver",
    "acorn",
    "caniuse-lite",
  ],
  suggestedQs: [
    "How does App Router handle React Server Components?",
    "What is the difference between the Pages Router and App Router?",
    "How does Next.js optimize images with next/image?",
    "How does streaming SSR work in Next.js 14+?",
  ],
};
