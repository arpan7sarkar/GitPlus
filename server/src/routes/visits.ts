import { Router } from "express";

const router = Router();

router.post("/track", async (req, res) => {
  res.json({ success: true });
});

router.get("/stats", async (req, res) => {
  res.json({ count: 0 });
});

export default router;
