import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";

import chatRouter from "./routes/chat.js";
import repoRouter from "./routes/repo.js";
import issuesRouter from "./routes/issues.js";
import sessionsRouter from "./routes/sessions.js";
import visitsRouter from "./routes/visits.js";
import searchRouter from "./routes/search.js";

import { ensureCollection, countPoints } from "./lib/actian.js";
import { prisma } from "./lib/prisma.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));

// Rate limiting: 200 requests per 15 minutes window for /api/ routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again in 15 minutes." },
});

app.use("/api/", limiter);

// API Route Mounts
app.use("/api/chat", chatRouter);
app.use("/api/repo", repoRouter);
app.use("/api/repo", issuesRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/visits", visitsRouter);
app.use("/api/search", searchRouter);

// Health Check Endpoint (Postgres + Actian status)
app.get("/health", async (_req, res) => {
  try {
    let postgresStatus = "disconnected";
    try {
      await prisma.$queryRaw`SELECT 1`;
      postgresStatus = "connected";
    } catch (dbErr) {
      console.warn("[health] Postgres ping failed:", dbErr);
    }

    const vectorCount = await countPoints();
    const vectorStatus = vectorCount >= 0 ? "connected" : "disconnected";

    const isHealthy = postgresStatus === "connected" && vectorStatus === "connected";

    return res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? "ok" : "degraded",
      service: "gitplus-server",
      postgres: postgresStatus,
      vectorai: vectorStatus,
      vectorPointCount: vectorCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({
      status: "error",
      error: err.message || "Health check failed",
    });
  }
});

// Server Initialization
app.listen(PORT, async () => {
  console.log(`[gitplus-server] Server running on http://localhost:${PORT}`);
  await ensureCollection();
  console.log("[gitplus-server] Actian VectorAI collection verified");
});
