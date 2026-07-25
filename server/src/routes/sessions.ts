/**
 * Route: /api/sessions
 * Replaces: Supabase chat_sessions table operations
 *
 * Endpoints:
 *   - POST /api/sessions     - Creates a new chat session in Neon Postgres
 *   - GET  /api/sessions/:id - Loads a chat session by ID (used for /shared/:sessionId)
 *   - PUT  /api/sessions/:id - Updates the messages array of a chat session
 */

import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

// POST /api/sessions
router.post("/", async (req: Request, res: Response) => {
  try {
    const { repoId, repoMeta = {}, repoContext = "", userId } = req.body;
    if (!repoId) {
      return res.status(400).json({ error: "repoId is required" });
    }

    const session = await prisma.chatSession.create({
      data: {
        repoId,
        userId: userId || null,
        repoMeta: repoMeta || {},
        repoContext: repoContext || "",
        messages: [],
        isPublic: true,
      },
    });

    return res.json({ id: session.id });
  } catch (err: any) {
    console.error("[sessions create error]:", err);
    return res.status(500).json({ error: err.message || "Failed to create chat session" });
  }
});

// GET /api/sessions/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "session id required" });
    }

    const session = await prisma.chatSession.findUnique({
      where: { id },
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    return res.json({
      id: session.id,
      repoId: session.repoId,
      repo_id: session.repoId,
      userId: session.userId,
      user_id: session.userId,
      repoMeta: session.repoMeta,
      repo_meta: session.repoMeta,
      messages: session.messages,
      repoContext: session.repoContext,
      repo_context: session.repoContext,
      isPublic: session.isPublic,
      is_public: session.isPublic,
      createdAt: session.createdAt,
      created_at: session.createdAt,
      updatedAt: session.updatedAt,
      updated_at: session.updatedAt,
    });
  } catch (err: any) {
    console.error("[sessions load error]:", err);
    return res.status(500).json({ error: err.message || "Failed to load chat session" });
  }
});

// PUT /api/sessions/:id
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { messages } = req.body;

    if (!id || !Array.isArray(messages)) {
      return res.status(400).json({ error: "session id and messages array required" });
    }

    const serializedMessages = messages.map((m: any) => ({
      ...m,
      timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
    }));

    await prisma.chatSession.update({
      where: { id },
      data: {
        messages: serializedMessages,
        updatedAt: new Date(),
      },
    });

    return res.json({ success: true });
  } catch (err: any) {
    console.error("[sessions update error]:", err);
    return res.status(500).json({ error: err.message || "Failed to update chat session" });
  }
});

export default router;
