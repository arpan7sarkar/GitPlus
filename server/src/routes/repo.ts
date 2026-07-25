/**
 * Route: /api/repo
 * Replaces: supabase/functions/repo-index, repo-file, repo-fetch-batch
 *
 * Endpoints:
 *   - POST /api/repo/index       - Indexes GitHub repo (full or on-demand mode)
 *   - POST /api/repo/file        - Single file fetch with base64 decode (max 200k chars)
 *   - POST /api/repo/fetch-batch - Batch file fetch up to 10 files (concurrency 3)
 */

import { Router, Request, Response } from "express";

const router = Router();

// File extensions to include in indexing
const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".rb",
  ".vue", ".svelte", ".css", ".scss", ".html", ".json", ".yaml", ".yml",
  ".toml", ".md", ".sql", ".graphql", ".prisma", ".env.example",
]);

// Directories to exclude
const EXCLUDED_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "__pycache__",
  ".cache", "coverage", ".turbo", ".vercel", "vendor", "target",
]);

// On-demand threshold
const FULL_INDEX_LIMIT = 300;

// Files always fetched in on-demand mode
const SKELETON_FILE_NAMES = new Set([
  "README.md", "readme.md", "README.rst",
  "package.json", "package-lock.json",
  "tsconfig.json", "tsconfig.app.json", "tsconfig.node.json",
  "Cargo.toml", "Cargo.lock",
  "go.mod", "go.sum",
  "pyproject.toml", "setup.py", "setup.cfg", "requirements.txt", "Pipfile",
  "Gemfile", "Gemfile.lock",
  "Dockerfile", "docker-compose.yml", "docker-compose.yaml",
  "Makefile", "CMakeLists.txt",
  ".env.example", ".env.sample",
  "vite.config.ts", "vite.config.js",
  "next.config.js", "next.config.ts", "next.config.mjs",
  "webpack.config.js", "rollup.config.js",
  "tailwind.config.ts", "tailwind.config.js",
  "postcss.config.js", "postcss.config.cjs",
  ".eslintrc.js", ".eslintrc.json", "eslint.config.js",
  ".prettierrc", ".prettierrc.json",
  "jest.config.js", "jest.config.ts", "vitest.config.ts",
  "prisma/schema.prisma",
]);

function isSkeletonFile(filePath: string): boolean {
  const parts = filePath.split("/");
  const fileName = parts[parts.length - 1];

  if (SKELETON_FILE_NAMES.has(fileName)) return true;
  if (SKELETON_FILE_NAMES.has(filePath)) return true;
  if (parts.length === 1) return true;

  if (parts.length === 2) {
    const topDir = parts[0].toLowerCase();
    if (["src", "lib", "app", "pages", "api", "routes", "cmd", "pkg", "internal"].includes(topDir)) {
      return true;
    }
  }

  return false;
}

function shouldIncludeFile(path: string): boolean {
  const parts = path.split("/");
  for (const part of parts) {
    if (EXCLUDED_DIRS.has(part)) return false;
  }

  const ext = "." + path.split(".").pop()?.toLowerCase();
  if (SOURCE_EXTENSIONS.has(ext)) return true;

  const fileName = parts[parts.length - 1];
  if (["package.json", "README.md", "Dockerfile", "Makefile", "Cargo.toml", "go.mod"].includes(fileName)) {
    return true;
  }

  return false;
}

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/\s?#]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

function buildFileTree(paths: string[]): any[] {
  const root: any[] = [];
  const map = new Map<string, any>();

  for (const path of paths) {
    const parts = path.split("/");
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!map.has(currentPath)) {
        const isFile = i === parts.length - 1;
        const node: any = {
          name: part,
          path: currentPath,
          type: isFile ? "file" : "folder",
        };
        if (!isFile) node.children = [];
        if (isFile) {
          const ext = part.split(".").pop()?.toLowerCase() || "";
          const langMap: Record<string, string> = {
            ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
            py: "python", go: "go", rs: "rust", java: "java", rb: "ruby",
            css: "css", html: "html", json: "json", md: "markdown", sql: "sql",
          };
          node.language = langMap[ext] || ext;
        }

        map.set(currentPath, node);

        if (parentPath && map.has(parentPath)) {
          map.get(parentPath).children.push(node);
        } else if (!parentPath) {
          root.push(node);
        }
      }
    }
  }

  return root;
}

// POST /api/repo/index
router.post("/index", async (req: Request, res: Response) => {
  try {
    const { githubUrl, githubToken } = req.body;
    console.log(`[repo-index] Indexing repository: ${githubUrl}`);

    const parsed = parseGitHubUrl(githubUrl);
    if (!parsed) {
      return res.json({ error: "Invalid GitHub URL" });
    }

    const { owner, repo } = parsed;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "GitPlus-AI",
    };
    if (githubToken) {
      headers.Authorization = `Bearer ${githubToken}`;
    }

    // Step 1: Get repo info
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!repoRes.ok) {
      const errText = await repoRes.text();
      let errorMsg = `GitHub API error: ${repoRes.status}`;
      if (repoRes.status === 404) errorMsg = "Repository not found or private (access denied)";
      if (repoRes.status === 401 || repoRes.status === 403) errorMsg = "GitHub API authorization failed or rate limit exceeded";

      return res.json({ error: errorMsg, details: errText });
    }
    const repoInfo = (await repoRes.json()) as any;

    // Step 2: Get file tree (recursive)
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${repoInfo.default_branch}?recursive=1`,
      { headers }
    );
    if (!treeRes.ok) {
      const errText = await treeRes.text();
      return res.json({ error: "Failed to fetch file tree", details: errText });
    }
    const treeData = (await treeRes.json()) as any;

    // Filter source files
    const sourceFiles = (treeData.tree || []).filter(
      (item: any) => item.type === "blob" && shouldIncludeFile(item.path)
    );

    const totalSourceFiles = sourceFiles.length;
    const isOnDemand = totalSourceFiles > FULL_INDEX_LIMIT;
    const indexMode = isOnDemand ? "on-demand" : "full";

    let filesToFetch: any[];
    if (isOnDemand) {
      filesToFetch = sourceFiles.filter((f: any) => isSkeletonFile(f.path));
    } else {
      filesToFetch = sourceFiles.slice(0, 200);
    }

    // Step 3: Fetch file contents (concurrency = 3)
    const fileContents: { path: string; content: string; size: number }[] = new Array(filesToFetch.length);
    const CONCURRENCY = 3;
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const fetchFile = async (idx: number, retry = false) => {
      const file = filesToFetch[idx];
      try {
        const fileRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`,
          { headers }
        );

        if (fileRes.ok) {
          const data = (await fileRes.json()) as any;
          if (data.encoding === "base64" && data.content) {
            const decoded = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
            fileContents[idx] = {
              path: file.path,
              content: decoded.slice(0, 3000),
              size: data.size,
            };
          }
        } else if ((fileRes.status === 403 || fileRes.status === 429) && !retry) {
          await delay(1000);
          return fetchFile(idx, true);
        } else {
          fileContents[idx] = {
            path: file.path,
            content: `// Warning: Failed to fetch (HTTP ${fileRes.status}).`,
            size: 0,
          };
        }
      } catch (e) {
        fileContents[idx] = {
          path: file.path,
          content: `// Warning: Fetch Error: ${e instanceof Error ? e.message : "Unknown"}.`,
          size: 0,
        };
      }
    };

    for (let i = 0; i < filesToFetch.length; i += CONCURRENCY) {
      const group = [];
      for (let j = 0; j < CONCURRENCY && i + j < filesToFetch.length; j++) {
        group.push(fetchFile(i + j));
      }
      await Promise.all(group);
      await delay(50);
    }

    const validContents = fileContents.filter((f) => f !== undefined);
    const fileTree = buildFileTree(sourceFiles.map((f: any) => f.path));

    const repoContext = validContents
      .map((f) => `--- ${f.path} ---\n${f.content}`)
      .join("\n\n");

    const fetchedPaths = new Set(filesToFetch.map((f: any) => f.path));
    const unfetchedFiles = isOnDemand
      ? sourceFiles
          .filter((f: any) => !fetchedPaths.has(f.path))
          .map((f: any) => ({ path: f.path, size: f.size || 0 }))
      : [];

    return res.json({
      repoId: `gh-${owner}-${repo}-${Date.now().toString(36)}`,
      meta: {
        id: `gh-${owner}-${repo}`,
        name: repo,
        owner,
        description: repoInfo.description || "",
        stars: repoInfo.stargazers_count,
        forks: repoInfo.forks_count,
        language: repoInfo.language || "Unknown",
        fileCount: totalSourceFiles,
        framework: "Detected",
        complexity:
          totalSourceFiles > 1000
            ? "Enterprise"
            : totalSourceFiles > 500
            ? "High"
            : totalSourceFiles > 100
            ? "Medium"
            : "Low",
      },
      fileTree,
      fileContents: validContents,
      repoContext,
      totalFiles: totalSourceFiles,
      indexMode,
      totalSourceFiles,
      skeletonFilesFetched: filesToFetch.length,
      unfetchedFiles,
    });
  } catch (err: any) {
    console.error("[repo-index error]:", err);
    return res.status(500).json({ error: err.message || "Failed to index repository" });
  }
});

// POST /api/repo/file
router.post("/file", async (req: Request, res: Response) => {
  try {
    const { owner, repo, path, githubToken } = req.body;
    if (!owner || !repo || !path) {
      return res.status(400).json({ error: "owner, repo, and path parameters required" });
    }

    const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
    if (githubToken) headers.Authorization = `Bearer ${githubToken}`;

    const fileRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { headers });
    if (!fileRes.ok) {
      const errText = await fileRes.text().catch(() => "");
      return res.status(fileRes.status).json({ error: `GitHub API error ${fileRes.status}: ${errText}` });
    }

    const data = (await fileRes.json()) as any;
    if (data.encoding !== "base64" || !data.content) {
      return res.status(400).json({ error: "Unsupported file encoding or empty content" });
    }

    const decoded = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
    return res.json({
      path,
      content: decoded.slice(0, 200_000),
      size: data.size,
    });
  } catch (err: any) {
    console.error("[repo-file error]:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch file content" });
  }
});

// POST /api/repo/fetch-batch
router.post("/fetch-batch", async (req: Request, res: Response) => {
  try {
    const { owner, repo, paths, githubToken } = req.body;
    if (!owner || !repo || !Array.isArray(paths)) {
      return res.status(400).json({ error: "owner, repo, and paths array required" });
    }

    if (paths.length > 10) {
      return res.status(400).json({ error: "paths array must contain at most 10 paths per batch" });
    }

    const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
    if (githubToken) headers.Authorization = `Bearer ${githubToken}`;

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const CONCURRENCY = 3;
    const results: { path: string; content: string; size: number; error?: string }[] = [];
    let errors = 0;

    for (let i = 0; i < paths.length; i += CONCURRENCY) {
      const batch = paths.slice(i, i + CONCURRENCY);
      const settled = await Promise.allSettled(
        batch.map(async (p: string) => {
          const fileRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${p}`, { headers });
          if (!fileRes.ok) throw new Error(`HTTP ${fileRes.status}`);
          const data = (await fileRes.json()) as any;
          const decoded = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
          return { path: p, content: decoded.slice(0, 200_000), size: data.size };
        })
      );

      for (let j = 0; j < settled.length; j++) {
        const item = settled[j];
        if (item.status === "fulfilled") {
          results.push(item.value);
        } else {
          errors++;
          results.push({
            path: batch[j],
            content: "",
            size: 0,
            error: item.reason?.message || "Failed to fetch file",
          });
        }
      }

      if (i + CONCURRENCY < paths.length) await delay(50);
    }

    return res.json({
      files: results,
      fetched: results.filter((r) => !r.error).length,
      errors,
    });
  } catch (err: any) {
    console.error("[repo-fetch-batch error]:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch batch files" });
  }
});

export default router;
