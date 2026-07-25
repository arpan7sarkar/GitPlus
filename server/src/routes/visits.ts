/**
 * Route: /api/visits
 * Replaces: supabase/functions/track-visit & supabase/functions/stats
 *
 * Endpoints:
 *   - POST /api/visits/track - Records visitor analytics with 24-hour deduplication
 *   - GET  /api/visits/stats - Returns total unique visitor count
 */

import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

// POST /api/visits/track
router.post("/track", async (req: Request, res: Response) => {
  try {
    const visitorId = req.body.visitor_id || req.body.visitorId;
    if (!visitorId) {
      return res.status(400).json({ error: "visitor_id or visitorId is required" });
    }

    const rawIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "";
    const ip = rawIp.split(",")[0].trim();
    const userAgent = req.headers["user-agent"] || "";

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 24-hour deduplication check by visitorId or IP address
    const existingVisit = await prisma.visit.findFirst({
      where: {
        OR: [
          { visitorId: String(visitorId) },
          ...(ip ? [{ ip }] : []),
        ],
        createdAt: {
          gte: twentyFourHoursAgo,
        },
      },
    });

    if (!existingVisit) {
      await prisma.visit.create({
        data: {
          visitorId: String(visitorId),
          ip: ip || null,
          userAgent: userAgent || null,
        },
      });
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error("[visits track error]:", err);
    return res.status(500).json({ error: err.message || "Failed to track visit" });
  }
});

// GET /api/visits/stats
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const count = await prisma.visit.count();
    return res.json({ count });
  } catch (err: any) {
    console.error("[visits stats error]:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch visit stats" });
  }
});

export default router;
