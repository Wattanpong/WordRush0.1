// routes/typing-leaderboard.js
import express from "express";
import TypingBest from "../models/TypingBest.js";
import User from "../models/User.js"; // สมมติคุณมีโมเดลผู้ใช้

const router = express.Router();

router.get("/typing/leaderboard", async (req, res) => {
  const level = String(req.query.level || "easy").toLowerCase();
  const limit = Math.min(Number(req.query.limit || 50), 200);

  const top = await TypingBest.find({ level })
    .sort({ best: -1, updatedAt: 1 })
    .limit(limit)
    .lean();

  // join ชื่อผู้ใช้แบบง่ายๆ (ทำให้เร็วขึ้นควร cache/aggregate)
  const userIds = top.map(r => r.userId);
  const users = await User.find({ _id: { $in: userIds } })
    .select("_id name")
    .lean();
  const nameById = Object.fromEntries(users.map(u => [String(u._id), u.name || "Player"]));

  const rows = top.map((r, idx) => ({
    rank: idx + 1,
    userId: r.userId,
    name: nameById[r.userId] || "Player",
    best: r.best,
    updatedAt: r.updatedAt,
  }));

  res.json({ data: rows });
});

export default router;
