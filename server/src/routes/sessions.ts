import { Router } from "express";

const router = Router();

router.post("/", async (req, res) => {
  res.json({ id: "stub" });
});

router.get("/:id", async (req, res) => {
  res.json({ message: "Session stub" });
});

router.put("/:id", async (req, res) => {
  res.json({ success: true });
});

export default router;
