// Mock data index — demo repository: vercel/next.js

import type { RepoMeta, FileNode } from "../api";

export const MOCK_REPO_META: RepoMeta = {
  id: "gh-vercel-next-js-1720000000",
  owner: "vercel",
  name: "next.js",
  description: "The React Framework for the Web — production-ready, with hybrid rendering and more.",
  language: "TypeScript",
  stars: 127400,
  fileCount: 847,
  framework: "Next.js",
};

export const MOCK_FILE_TREE: FileNode[] = [
  {
    path: "packages",
    type: "dir",
    children: [
      {
        path: "packages/next",
        type: "dir",
        children: [
          { path: "packages/next/src/server/app-render/app-render.tsx", type: "file", size: 18240 },
          { path: "packages/next/src/server/next-server.ts", type: "file", size: 12400 },
          { path: "packages/next/src/client/router.ts", type: "file", size: 9800 },
          { path: "packages/next/src/build/webpack-config.ts", type: "file", size: 22100 },
          { path: "packages/next/src/lib/router/utils/route-matcher.ts", type: "file", size: 4200 },
        ],
      },
      {
        path: "packages/font",
        type: "dir",
        children: [
          { path: "packages/font/src/index.ts", type: "file", size: 1200 },
        ],
      },
    ],
  },
  {
    path: "examples",
    type: "dir",
    children: [
      { path: "examples/with-tailwindcss/app/page.tsx", type: "file", size: 800 },
      { path: "examples/blog-starter/app/page.tsx", type: "file", size: 1400 },
    ],
  },
  { path: "package.json", type: "file", size: 4200 },
  { path: "tsconfig.json", type: "file", size: 900 },
  { path: "turbo.json", type: "file", size: 2100 },
  { path: "README.md", type: "file", size: 8400 },
];

export const MOCK_FILE_CONTENTS: Record<string, string> = {
  "packages/next/src/server/next-server.ts": `/**
 * Next.js Server — core HTTP request handler.
 * Handles routing, rendering, and response streaming.
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';

export class NextNodeServer {
  private readonly dir: string;
  private readonly quiet: boolean;

  constructor({ dir, quiet }: { dir: string; quiet?: boolean }) {
    this.dir = dir;
    this.quiet = quiet ?? false;
  }

  async handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
    parsedUrl?: ReturnType<typeof parse>
  ): Promise<void> {
    const url = parsedUrl ?? parse(req.url ?? '/', true);
    // Route to appropriate renderer
    await this.renderToResponse(req, res, url);
  }

  private async renderToResponse(
    req: IncomingMessage,
    res: ServerResponse,
    url: ReturnType<typeof parse>
  ): Promise<void> {
    // Implementation in app-render.tsx
    res.statusCode = 200;
    res.end('');
  }
}
`,
  "packages/next/src/client/router.ts": `/**
 * Next.js Client Router
 * Handles client-side navigation and prefetching.
 */
import { createRouter } from './create-router';

export interface RouterOptions {
  pathname: string;
  query: Record<string, string | string[]>;
  asPath: string;
}

export class Router {
  private readonly history: RouterOptions[] = [];

  push(url: string, as?: string): Promise<boolean> {
    return Promise.resolve(true);
  }

  replace(url: string, as?: string): Promise<boolean> {
    return Promise.resolve(true);
  }

  back(): void {
    window.history.back();
  }

  prefetch(url: string): Promise<void> {
    return Promise.resolve();
  }
}
`,
  "package.json": `{
  "name": "next.js",
  "version": "14.0.0",
  "private": true,
  "workspaces": ["packages/*", "examples/*"],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "test": "jest",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "turbo": "^1.10.0"
  }
}
`,
};

export const MOCK_REPO_CONTEXT = `
Repository: vercel/next.js
Language: TypeScript
Stars: 127,400
Files: 847
Framework: Next.js (monorepo with Turbo)

Architecture:
- Monorepo structure managed by Turborepo
- Core package: packages/next — contains server, client, build tooling
- App Router (app/) and Pages Router (pages/) both supported
- Server Components and Streaming SSR via React 18
- Edge Runtime support via packages/next/src/server/web/

Key Files:
- packages/next/src/server/app-render/app-render.tsx — React Server Component renderer
- packages/next/src/server/next-server.ts — HTTP request handler
- packages/next/src/client/router.ts — Client navigation
- packages/next/src/build/webpack-config.ts — Build configuration
- packages/next/src/lib/router/utils/route-matcher.ts — Route matching

Main Dependencies:
- React 18, react-dom 18
- @swc/core — Rust-based transpiler
- webpack 5
- styled-jsx — CSS-in-JS
- turbo — monorepo build system

Complexity: Enterprise
`;
