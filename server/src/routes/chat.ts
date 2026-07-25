import { Router } from "express";

const router = Router();

router.post("/", async (req, res) => {
  res.json({ message: "Chat router stub" });
});

export default router;
