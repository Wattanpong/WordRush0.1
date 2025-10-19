// routes/words.js
import express from "express";
import { Word } from "../models/Word.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// ดึง payload จาก Header เพื่อใช้ซ้ำ
const auth = (req, res, next) => {
  try {
    const raw = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!raw) return res.status(401).json({ error: "missing token" });
    const payload = jwt.verify(raw, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "invalid token" });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role === "admin") return next();
  return res.status(403).json({ error: "forbidden: admin only" });
};

/* อ่านคำแบบสุ่ม (public หรือจะใส่ auth ก็ได้) */
router.get("/random", async (req, res) => {
  try {
    const level = req.query.level || "easy";
    const docs = await Word.aggregate([{ $match: { level } }, { $sample: { size: 1 } }]);
    if (!docs.length) return res.status(404).json({ error: "ไม่พบคำในระดับนี้" });
    res.json(docs[0]);
  } catch (err) {
    console.error("❌ Error random word:", err);
    res.status(500).json({ error: "ไม่สามารถดึงคำศัพท์ได้" });
  }
});

/* list ทั้งระดับ (public หรือจะบังคับ auth ก็ได้) */
router.get("/", async (req, res) => {
  try {
    const filter = req.query.level ? { level: req.query.level } : {};
    const list = await Word.find(filter).sort({ term: 1 }).lean();
    res.json(list);
  } catch (err) {
    console.error("❌ Error list words:", err);
    res.status(500).json({ error: "ไม่สามารถดึงรายการคำศัพท์ได้" });
  }
});

/* เพิ่มคำ — admin เท่านั้น */
router.post("/", auth, requireAdmin, async (req, res) => {
  try {
    const { term, level, hint } = req.body || {};
    if (!term || !level) return res.status(400).json({ error: "term และ level จำเป็น" });
    const created = await Word.create({ term, level, hint });
    res.status(201).json(created);
  } catch (err) {
    console.error("❌ Error create word:", err);
    if (err.code === 11000) return res.status(409).json({ error: "คำนี้มีอยู่แล้วในระดับนี้" });
    res.status(500).json({ error: "เพิ่มคำศัพท์ไม่สำเร็จ" });
  }
});

/* ลบคำ — admin เท่านั้น */
router.delete("/:id", auth, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await Word.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ error: "ไม่พบคำนี้" });
    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Error delete word:", err);
    res.status(500).json({ error: "ลบคำศัพท์ไม่สำเร็จ" });
  }
});

export default router;
