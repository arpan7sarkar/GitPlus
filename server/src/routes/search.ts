import { Router } from "express";

const router = Router();

router.post("/ingest", async (req, res) => {
  res.json({ success: true, count: 0 });
});

router.post("/hybrid", async (req, res) => {
  res.json({ results: [] });
});

export default router;
