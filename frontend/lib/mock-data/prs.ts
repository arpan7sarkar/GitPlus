import type { GitHubPullRequest, GitHubCommit } from "../api";

const now = new Date().toISOString();
const dayAgo = new Date(Date.now() - 86400000).toISOString();
const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

export const MOCK_PRS: GitHubPullRequest[] = [
  {
    number: 62820,
    title: "feat: Add support for React 19 concurrent features",
    body: "This PR adds support for React 19's new `use()` hook and `Suspense` improvements. It also adds compatibility for `startTransition` in Server Actions.\n\n## Changes\n- Updated peer dependencies to support React 19\n- Added `use()` hook support in Client Components\n- Fixed `startTransition` type definitions\n\n## Testing\n- Added unit tests for `use()` hook integration\n- E2E tests pass on all browsers",
    state: "open",
    draft: false,
    merged_at: null,
    html_url: "https://github.com/vercel/next.js/pull/62820",
    updated_at: dayAgo,
    created_at: weekAgo,
    user: { login: "timneutkens", avatar_url: "https://avatars.githubusercontent.com/u/6?v=4" },
  },
  {
    number: 62815,
    title: "fix: Parallel Routes memory leak in development",
    body: "Fixes #62814. The root cause was that route component instances were not being garbage collected when navigating away from parallel routes.\n\n## Root Cause\nThe `WeakMap` storing component references was inadvertently holding strong references through event listeners.\n\n## Fix\nProper cleanup in `useEffect` return function for parallel route segments.",
    state: "open",
    draft: false,
    merged_at: null,
    html_url: "https://github.com/vercel/next.js/pull/62815",
    updated_at: dayAgo,
    created_at: dayAgo,
    user: { login: "shuding", avatar_url: "https://avatars.githubusercontent.com/u/7?v=4" },
  },
  {
    number: 62800,
    title: "chore: Update Turbopack to latest stable",
    body: "Updates Turbopack to v1.0.3 with improved HMR performance and fixed Windows path handling.",
    state: "open",
    draft: true,
    merged_at: null,
    html_url: "https://github.com/vercel/next.js/pull/62800",
    updated_at: weekAgo,
    created_at: weekAgo,
    user: { login: "devknoll", avatar_url: "https://avatars.githubusercontent.com/u/8?v=4" },
  },
  {
    number: 62750,
    title: "feat: Server Actions now support FormData streaming",
    body: "Allows Server Actions to receive streaming FormData for large file uploads.",
    state: "closed",
    draft: false,
    merged_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    html_url: "https://github.com/vercel/next.js/pull/62750",
    updated_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 8 * 86400000).toISOString(),
    user: { login: "wyattjoh", avatar_url: "https://avatars.githubusercontent.com/u/9?v=4" },
  },
];

export const MOCK_DIFF = `diff --git a/packages/next/src/server/app-render/app-render.tsx b/packages/next/src/server/app-render/app-render.tsx
index a1b2c3d..e4f5g6h 100644
--- a/packages/next/src/server/app-render/app-render.tsx
+++ b/packages/next/src/server/app-render/app-render.tsx
@@ -45,7 +45,7 @@ export async function renderToHTMLOrFlight(
   renderOpts: RenderOpts
 ): Promise<RenderResult> {
   const { Component, params } = await resolveRouteComponent(pathname);
-  const stream = await createStaticStream(Component, { params });
+  const stream = await createStaticStream(Component, { params, react19: true });
   return new RenderResult(stream, renderOpts);
 }
 
@@ -102,6 +102,11 @@ async function createStaticStream(
   Component: React.ComponentType,
   props: Record<string, unknown>
 ): Promise<ReadableStream> {
+  if (props.react19) {
+    // Use new React 19 concurrent stream API
+    return renderToReadableStream(<Component {...props} />, { bootstrapScripts: [] });
+  }
   return ReactDOM.renderToReadableStream(<Component {...props} />);
 }`;
