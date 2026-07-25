import { Router } from "express";

const router = Router();

router.post("/issues", async (req, res) => {
  res.json({ issues: [] });
});

router.get("/pulls", async (req, res) => {
  res.json({ pulls: [] });
});

router.get("/commits", async (req, res) => {
  res.json({ commits: [] });
});

router.get("/pulls/:pr/diff", async (req, res) => {
  res.setHeader("Content-Type", "text/plain");
  res.send("");
});

export default router;
