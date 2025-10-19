// routes/typing.js
const express = require("express");
const router = express.Router();
const TypingBest = require("../models/TypingBest");
import mongoose from "mongoose";

const TypingBestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    level:  { type: String, enum: ["easy","normal","hard"], required: true, index: true },
    best:   { type: Number, default: 0 },
  },
  { timestamps: true }
);

// GET /api/typing/best?level=easy
router.get("/best", async (req, res) => {
  const userId = req.user._id;                 // ต้องล็อกอิน
  const level = String(req.query.level || "").toLowerCase();
  if (!["easy","normal","hard"].includes(level)) {
    return res.status(400).json({ error: "invalid level" });
  }
  const doc = await TypingBest.findOne({ userId, level });
  res.json({ level, best: doc?.best ?? 0 });
});

// POST /api/typing/best  { level, score }
router.post("/best", async (req, res) => {
  const userId = req.user._id;
  const { level, score } = req.body || {};
  if (!["easy","normal","hard"].includes(level)) {
    return res.status(400).json({ error: "invalid level" });
  }
  const val = Math.max(0, Number(score || 0));
  const updated = await TypingBest.findOneAndUpdate(
    { userId, level },
    { $max: { best: val } },              // 👈 เก็บค่าสูงสุด
    { new: true, upsert: true }
  );
  res.json({ level, best: updated.best });
});

TypingBestSchema.index({ userId: 1, level: 1 }, { unique: true });

const TypingBest = mongoose.model("TypingBest", TypingBestSchema);

module.exports = router;
