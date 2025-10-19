// routes/typing.js
import express from "express";
import TypingBest from "../models/TypingBest.js";
import auth from "../middleware/auth.js";

const router = express.Router();

/** อ่าน best ของผู้ใช้ ปัจจุบัน ต่อระดับ */
router.get("/typing/best", auth, async (req, res) => {
  const level = String(req.query.level || "easy").toLowerCase();
  if (!["easy","normal","hard"].includes(level)) {
    return res.status(400).json({ error: "invalid level" });
  }
  const userId = req.user.id;
  const doc = await TypingBest.findOne({ userId, level }).lean();
  res.json({ level, best: doc?.best ?? 0 });
});

/** อัปเดต best ของผู้ใช้ (ถ้าส่งคะแนนมากกว่าเดิมเท่านั้น) */
router.post("/typing/best", auth, async (req, res) => {
  const level = String(req.body?.level || "").toLowerCase();
  const score = Number(req.body?.score || 0);
  if (!["easy","normal","hard"].includes(level)) {
    return res.status(400).json({ error: "invalid level" });
  }
  const userId = req.user.id;

  const updated = await TypingBest.findOneAndUpdate(
    { userId, level },
    { $max: { best: score }, $set: { updatedAt: new Date() } },
    { upsert: true, new: true }
  ).lean();

  res.json({ level, best: updated.best });
});

/** (ออปชัน) ดึง best ทั้ง 3 ระดับทีเดียว */
router.get("/typing/bests", auth, async (req, res) => {
  const userId = req.user.id;
  const rows = await TypingBest.find({ userId }).lean();
  const map = Object.fromEntries(rows.map(r => [r.level, r.best]));
  res.json({
    easy: map.easy ?? 0,
    normal: map.normal ?? 0,
    hard: map.hard ?? 0,
  });
});

export default router;
