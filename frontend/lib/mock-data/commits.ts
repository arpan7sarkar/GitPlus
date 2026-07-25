import type { GitHubCommit } from "../api";

const d = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString();

export const MOCK_COMMITS: GitHubCommit[] = [
  {
    sha: "a1b2c3d4e5f6789012345678901234567890abcd",
    html_url: "https://github.com/vercel/next.js/commit/a1b2c3d",
    commit: {
      message: "feat: Add React 19 concurrent rendering support\n\nEnables startTransition in Server Actions and use() hook in Client Components.",
      author: { name: "Tim Neutkens", email: "tim@vercel.com", date: d(0) },
    },
    author: { login: "timneutkens", avatar_url: "https://avatars.githubusercontent.com/u/6?v=4" },
  },
  {
    sha: "b2c3d4e5f6789012345678901234567890abcde1",
    html_url: "https://github.com/vercel/next.js/commit/b2c3d4e",
    commit: {
      message: "fix: Parallel Routes memory leak in development mode\n\nProper WeakRef cleanup in useEffect for parallel route segments.",
      author: { name: "Shu Ding", email: "shu@vercel.com", date: d(1) },
    },
    author: { login: "shuding", avatar_url: "https://avatars.githubusercontent.com/u/7?v=4" },
  },
  {
    sha: "c3d4e5f6789012345678901234567890abcdef12",
    html_url: "https://github.com/vercel/next.js/commit/c3d4e5f",
    commit: {
      message: "chore: Update Turbopack to v1.0.3",
      author: { name: "Jiachi Liu", email: "jiachi@vercel.com", date: d(2) },
    },
    author: { login: "huozhi", avatar_url: "https://avatars.githubusercontent.com/u/8?v=4" },
  },
  {
    sha: "d4e5f6789012345678901234567890abcdef1234",
    html_url: "https://github.com/vercel/next.js/commit/d4e5f67",
    commit: {
      message: "perf: Improve HMR startup time by 40% via module graph caching",
      author: { name: "Alex Castle", email: "alex@vercel.com", date: d(3) },
    },
    author: { login: "alexkirsz", avatar_url: "https://avatars.githubusercontent.com/u/9?v=4" },
  },
  {
    sha: "e5f6789012345678901234567890abcdef123456",
    html_url: "https://github.com/vercel/next.js/commit/e5f6789",
    commit: {
      message: "fix: Safari 17 useRouter().refresh() causes full page reload\n\nResolves #62801. Root cause was SameSite cookie handling difference in Safari.",
      author: { name: "Wyatt Johnson", email: "wyatt@vercel.com", date: d(4) },
    },
    author: { login: "wyattjoh", avatar_url: "https://avatars.githubusercontent.com/u/10?v=4" },
  },
  {
    sha: "f6789012345678901234567890abcdef12345678",
    html_url: "https://github.com/vercel/next.js/commit/f678901",
    commit: {
      message: "docs: Update App Router migration guide for Next.js 14",
      author: { name: "Lee Robinson", email: "lee@vercel.com", date: d(5) },
    },
    author: { login: "leerob", avatar_url: "https://avatars.githubusercontent.com/u/11?v=4" },
  },
  {
    sha: "g789012345678901234567890abcdef123456789",
    html_url: "https://github.com/vercel/next.js/commit/g789012",
    commit: {
      message: "feat: Server Actions now support streaming FormData for large uploads",
      author: { name: "Wyatt Johnson", email: "wyatt@vercel.com", date: d(6) },
    },
    author: { login: "wyattjoh", avatar_url: "https://avatars.githubusercontent.com/u/10?v=4" },
  },
  {
    sha: "h890123456789012345678901234567890abcdef",
    html_url: "https://github.com/vercel/next.js/commit/h890123",
    commit: {
      message: "fix: next/font Inter variable font fallback metrics CLS issue",
      author: { name: "Maia Teegarden", email: "maia@vercel.com", date: d(7) },
    },
    author: { login: "padmaia", avatar_url: "https://avatars.githubusercontent.com/u/12?v=4" },
  },
];
