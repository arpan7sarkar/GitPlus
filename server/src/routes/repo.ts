import { Router } from "express";

const router = Router();

router.post("/index", async (req, res) => {
  res.json({ message: "Repo index router stub" });
});

router.post("/file", async (req, res) => {
  res.json({ message: "Repo file router stub" });
});

router.post("/fetch-batch", async (req, res) => {
  res.json({ message: "Repo fetch-batch router stub" });
});

export default router;
