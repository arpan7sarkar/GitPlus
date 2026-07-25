import type { GitHubIssue } from "../api";

const now = new Date().toISOString();
const dayAgo = new Date(Date.now() - 86400000).toISOString();
const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();

export const MOCK_ISSUES: GitHubIssue[] = [
  {
    number: 62814,
    title: "App Router: Parallel Routes cause memory leak in development mode",
    body: "When using Parallel Routes with dynamic segments, the dev server leaks memory over time. After ~30 minutes of development, the process uses 2GB+ RAM.\n\n**Steps to reproduce:**\n1. Create `@modal/(.)photo/[id]/page.tsx`\n2. Navigate between routes repeatedly\n3. Monitor `node` process memory\n\n**Expected:** Memory stable around 200-400MB\n**Actual:** Memory grows unbounded",
    state: "open",
    html_url: "https://github.com/vercel/next.js/issues/62814",
    labels: [
      { name: "bug", color: "d73a4a" },
      { name: "App Router", color: "0075ca" },
    ],
    comments: 23,
    updated_at: dayAgo,
    created_at: weekAgo,
    user: { login: "shadowfacsimile", avatar_url: "https://avatars.githubusercontent.com/u/1?v=4" },
  },
  {
    number: 62801,
    title: "useRouter().refresh() triggers full page reload in Safari 17",
    body: "Calling `router.refresh()` in Safari 17.x causes a full page reload instead of a soft refresh. This works correctly in Chrome and Firefox.\n\n**Environment:**\n- Next.js 14.1.0\n- Safari 17.2 (macOS Sonoma 14.2)\n\n**Expected behavior:** Soft refresh, re-fetching server data without full reload\n**Actual behavior:** Full page reload with scroll position lost",
    state: "open",
    html_url: "https://github.com/vercel/next.js/issues/62801",
    labels: [
      { name: "bug", color: "d73a4a" },
      { name: "Safari", color: "e4e669" },
    ],
    comments: 8,
    updated_at: dayAgo,
    created_at: weekAgo,
    user: { login: "mxkaske", avatar_url: "https://avatars.githubusercontent.com/u/2?v=4" },
  },
  {
    number: 62789,
    title: "Feature Request: Native support for CSS Container Queries in next/image",
    body: "It would be great if `next/image` supported container query breakpoints instead of only viewport-based sizes. Currently `sizes` prop only accepts viewport units.",
    state: "open",
    html_url: "https://github.com/vercel/next.js/issues/62789",
    labels: [
      { name: "feature request", color: "a2eeef" },
      { name: "next/image", color: "fbca04" },
    ],
    comments: 14,
    updated_at: weekAgo,
    created_at: monthAgo,
    user: { login: "balazsorban44", avatar_url: "https://avatars.githubusercontent.com/u/3?v=4" },
  },
  {
    number: 62751,
    title: "Middleware matcher does not handle encoded URI characters",
    body: "When a URL contains encoded characters like `%20`, the middleware matcher regex fails to match the expected pattern.\n\n```typescript\nexport const config = {\n  matcher: ['/dashboard/:path*']\n};\n```\n\nURL `/dashboard/my%20project` is not matched.",
    state: "open",
    html_url: "https://github.com/vercel/next.js/issues/62751",
    labels: [
      { name: "bug", color: "d73a4a" },
      { name: "Middleware", color: "0075ca" },
    ],
    comments: 5,
    updated_at: weekAgo,
    created_at: monthAgo,
    user: { login: "styfle", avatar_url: "https://avatars.githubusercontent.com/u/4?v=4" },
  },
  {
    number: 62710,
    title: "next/font: Variable font fallback metrics incorrect for Inter",
    body: "The auto-generated fallback CSS metrics for `next/font/google` with the Inter variable font produce a noticeable layout shift despite CLS prevention being the whole point.\n\n**Measured CLS:** 0.12 (should be near 0)\n**Font:** Inter (variable)",
    state: "closed",
    html_url: "https://github.com/vercel/next.js/issues/62710",
    labels: [
      { name: "bug", color: "d73a4a" },
      { name: "next/font", color: "fbca04" },
    ],
    comments: 31,
    updated_at: monthAgo,
    created_at: monthAgo,
    user: { login: "ijjk", avatar_url: "https://avatars.githubusercontent.com/u/5?v=4" },
  },
  {
    number: 62698,
    title: "Build fails with webpack 5 cache corruption when upgrading from 14.0 to 14.1",
    body: "After upgrading from 14.0.4 to 14.1.0, `next build` fails with:\n\n```\nError: ENOENT: no such file or directory, open '.next/cache/webpack/client-production/0.pack'\n```\n\nDeleting `.next/cache` resolves it but the problem returns on the next build.",
    state: "closed",
    html_url: "https://github.com/vercel/next.js/issues/62698",
    labels: [
      { name: "bug", color: "d73a4a" },
      { name: "build", color: "0052cc" },
    ],
    comments: 47,
    updated_at: monthAgo,
    created_at: monthAgo,
    user: { login: "timneutkens", avatar_url: "https://avatars.githubusercontent.com/u/6?v=4" },
  },
];
