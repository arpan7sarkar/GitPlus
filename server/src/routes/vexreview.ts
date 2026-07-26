/**
 * Route: /api/vexreview
 * AI PR reviewer — "add the action" to a repo (just a DB flag + a write-access
 * check, no files written to the user's repo, no GitHub Actions involved), then
 * hit a button to review any existing PR. The engine runs inside this server
 * (server/src/lib/vexreview/) using the requesting user's own GitHub token, so
 * review comments are posted as them.
 *
 * Endpoints:
 *   - POST /api/vexreview/enable         - Enable VexReview for a repo (verifies push access)
 *   - POST /api/vexreview/disable        - Disable VexReview for a repo
 *   - GET  /api/vexreview/status         - Enabled state + recent runs for a repo
 *   - POST /api/vexreview/review         - Kick off a review run for a PR (returns immediately, runs in background)
 *   - GET  /api/vexreview/runs/:id       - Poll a single run's live status/progress
 */

import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { getSessionUser, readSessionToken } from "../lib/auth.js";
import { decrypt } from "../lib/crypto.js";
import { runVexReview, type ReviewProgress } from "../lib/vexreview/index.js";

const router = Router();

const MAX_RUNS_PER_USER_PER_DAY = 20;

async function requireUser(req: Request, res: Response) {
  const user = await getSessionUser(readSessionToken(req));
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return user;
}

/** Confirms the user's own GitHub token actually has push access to the repo. */
async function verifyPushAccess(token: string, owner: string, repo: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "GitPlus-VexReview" },
    });
    if (res.status === 404) return { ok: false, error: "Repository not found or not accessible with your GitHub account" };
    if (!res.ok) return { ok: false, error: `GitHub API error ${res.status}` };
    const data = (await res.json()) as any;
    if (!data.permissions?.push) {
      return { ok: false, error: "You need write access to this repository to enable VexReview" };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to verify repository access" };
  }
}

// POST /api/vexreview/enable
router.post("/enable", async (req: Request, res: Response) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { owner, repo } = req.body as { owner?: string; repo?: string };
  if (!owner || !repo) return res.status(400).json({ error: "owner and repo are required" });

  try {
    const token = decrypt(user.accessToken);
    const access = await verifyPushAccess(token, owner, repo);
    if (!access.ok) return res.status(403).json({ error: access.error });

    const config = await prisma.vexReviewConfig.upsert({
      where: { userId_owner_repo: { userId: user.id, owner, repo } },
      create: { userId: user.id, owner, repo, enabled: true },
      update: { enabled: true },
    });

    return res.json({ config });
  } catch (err: any) {
    console.error("[vexreview] enable error:", err);
    return res.status(500).json({ error: err.message || "Failed to enable VexReview" });
  }
});

// POST /api/vexreview/disable
router.post("/disable", async (req: Request, res: Response) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { owner, repo } = req.body as { owner?: string; repo?: string };
  if (!owner || !repo) return res.status(400).json({ error: "owner and repo are required" });

  try {
    await prisma.vexReviewConfig.updateMany({
      where: { userId: user.id, owner, repo },
      data: { enabled: false },
    });
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[vexreview] disable error:", err);
    return res.status(500).json({ error: err.message || "Failed to disable VexReview" });
  }
});

// GET /api/vexreview/status?owner=&repo=
router.get("/status", async (req: Request, res: Response) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { owner, repo } = req.query as { owner?: string; repo?: string };
  if (!owner || !repo) return res.status(400).json({ error: "owner and repo query params are required" });

  const config = await prisma.vexReviewConfig.findUnique({
    where: { userId_owner_repo: { userId: user.id, owner, repo } },
    include: { runs: { orderBy: { startedAt: "desc" }, take: 10 } },
  });

  return res.json({
    enabled: config?.enabled ?? false,
    runs: config?.runs ?? [],
  });
});

// POST /api/vexreview/review — { owner, repo, prNumber }
router.post("/review", async (req: Request, res: Response) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { owner, repo, prNumber } = req.body as { owner?: string; repo?: string; prNumber?: number };
  if (!owner || !repo || !prNumber) {
    return res.status(400).json({ error: "owner, repo, and prNumber are required" });
  }

  try {
    const config = await prisma.vexReviewConfig.findUnique({
      where: { userId_owner_repo: { userId: user.id, owner, repo } },
    });
    if (!config || !config.enabled) {
      return res.status(400).json({ error: "VexReview isn't enabled for this repository yet" });
    }

    // Don't double-run the same PR concurrently.
    const activeRun = await prisma.vexReviewRun.findFirst({
      where: { configId: config.id, prNumber, status: { in: ["queued", "running"] } },
    });
    if (activeRun) {
      return res.json({ runId: activeRun.id, alreadyRunning: true });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentRunCount = await prisma.vexReviewRun.count({
      where: { userId: user.id, startedAt: { gte: since } },
    });
    if (recentRunCount >= MAX_RUNS_PER_USER_PER_DAY) {
      return res.status(429).json({ error: `Daily review limit reached (${MAX_RUNS_PER_USER_PER_DAY}/day). Try again tomorrow.` });
    }

    const run = await prisma.vexReviewRun.create({
      data: { configId: config.id, userId: user.id, prNumber, status: "queued" },
    });

    const token = decrypt(user.accessToken);

    // Kick off the review in the background — the LLM-heavy pipeline can take
    // minutes, so the client polls GET /runs/:id instead of holding a connection.
    void executeReview(run.id, token, owner, repo, prNumber);

    return res.json({ runId: run.id, alreadyRunning: false });
  } catch (err: any) {
    console.error("[vexreview] review trigger error:", err);
    return res.status(500).json({ error: err.message || "Failed to start review" });
  }
});

async function executeReview(runId: string, token: string, owner: string, repo: string, prNumber: number) {
  try {
    await prisma.vexReviewRun.update({
      where: { id: runId },
      data: { status: "running", stage: "diffing", stageMessage: "Starting review..." },
    });

    const onProgress = (p: ReviewProgress) => {
      prisma.vexReviewRun
        .update({ where: { id: runId }, data: { stage: p.stage, stageMessage: p.message } })
        .catch((e) => console.warn("[vexreview] progress update failed (non-fatal):", e));
    };

    const result = await runVexReview({ githubToken: token, owner, repo, prNumber, onProgress });

    await prisma.vexReviewRun.update({
      where: { id: runId },
      data: {
        status: "completed",
        stage: "done",
        stageMessage: result.reason || "Review complete",
        resultStatus: result.status,
        filesReviewed: result.filesReviewed,
        reviewComments: result.reviewCommentCount,
        lgtmCount: result.lgtmCount,
        completedAt: new Date(),
      },
    });
  } catch (err: any) {
    console.error(`[vexreview] run ${runId} failed:`, err);
    await prisma.vexReviewRun
      .update({
        where: { id: runId },
        data: { status: "failed", error: err.message || "Unknown error", completedAt: new Date() },
      })
      .catch(() => {});
  }
}

// GET /api/vexreview/runs/:id
router.get("/runs/:id", async (req: Request, res: Response) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const run = await prisma.vexReviewRun.findUnique({ where: { id: String(req.params.id) } });
  if (!run || run.userId !== user.id) return res.status(404).json({ error: "Run not found" });

  return res.json({ run });
});

export default router;
