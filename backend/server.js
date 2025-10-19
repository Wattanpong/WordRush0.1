// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import wordRoutes from "./routes/words.js";
import { Word } from "./models/Word.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ---------- DB ----------
const { MONGODB_URI, PORT = 5000, JWT_SECRET, JWT_EXPIRES = "7d" } = process.env;

async function connectDB() {
  try {
    if (!MONGODB_URI) throw new Error("Missing MONGODB_URI in .env");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDB connected successfully");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
}
await connectDB();

// ---------- User Model ----------
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },

    // คะแนนสูงสุด แยกตามระดับ
    bestScores: {
      easy:   { type: Number, default: 0 },
      normal: { type: Number, default: 0 },
      hard:   { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

// (ไม่ต้องใส่ index ซ้ำ ถ้ามี unique:true แล้ว)
// userSchema.index({ email: 1 }, { unique: true });

const User = mongoose.model("User", userSchema);

// ---------- Helpers ----------
const signToken = (user) => {
  if (!JWT_SECRET) throw new Error("JWT_SECRET missing");
  return jwt.sign(
    { sub: String(user._id), name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
};

const auth = (req, res, next) => {
  try {
    const raw = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!raw) return res.status(401).json({ error: "missing token" });
    const payload = jwt.verify(raw, JWT_SECRET);
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

// ---------- Basic ----------
app.get("/api/ping", (req, res) => res.json({ msg: "Server + MongoDB OK" }));

// ---------- Auth ----------
app.post("/api/auth/register", async (req, res) => {
  try {
    let { name, email, password } = req.body || {};
    name = String(name || "").trim();
    email = String(email || "").trim().toLowerCase();

    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email, password จำเป็น" });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: "อีเมลนี้ถูกใช้แล้ว" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash, role: "user" });

    const token = signToken(user);
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ error: "อีเมลนี้ถูกใช้แล้ว" });
    console.error("REGISTER_ERROR:", err);
    res.status(500).json({ error: "สมัครสมาชิกไม่สำเร็จ" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "email, password จำเป็น" });
    }
    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });

    const token = signToken(user);
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error("LOGIN_ERROR:", err);
    res.status(500).json({ error: "เข้าสู่ระบบไม่สำเร็จ" });
  }
});

app.get("/api/me", auth, async (req, res) => {
  const u = await User.findById(req.user.sub).select("_id name email role bestScores").lean();
  res.json(u);
});

// อัปเดตโปรไฟล์ผู้ใช้ (แก้ได้เฉพาะ name ตาม UI ปัจจุบัน)
app.put("/api/me", auth, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "กรุณากรอกชื่อ" });

    const updated = await User.findByIdAndUpdate(
      req.user.sub,
      { name },
      { new: true, runValidators: true }
    ).select("_id name email role bestScores");

    if (!updated) return res.status(404).json({ error: "ไม่พบผู้ใช้" });

    // โปรไฟล์ของคุณคาดหวังให้ response เป็นอ็อบเจ็กต์ผู้ใช้ตรง ๆ
    res.json(updated);
  } catch (err) {
    console.error("UPDATE_ME_ERROR:", err);
    res.status(500).json({ error: "บันทึกไม่สำเร็จ" });
  }
});

// เปลี่ยนรหัสผ่าน
app.post("/api/change-password", auth, async (req, res) => {
  try {
    const oldPassword = String(req.body?.oldPassword || "");
    const newPassword = String(req.body?.newPassword || "");

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: "กรุณากรอกรหัสผ่านให้ครบ" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "รหัสผ่านใหม่ต้องอย่างน้อย 6 ตัวอักษร" });
    }

    const user = await User.findById(req.user.sub).select("passwordHash");
    if (!user) return res.status(404).json({ error: "ไม่พบผู้ใช้" });

    const ok = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ ok: true });
  } catch (err) {
    console.error("CHANGE_PASSWORD_ERROR:", err);
    res.status(500).json({ error: "เปลี่ยนรหัสผ่านไม่สำเร็จ" });
  }
});


// ---------- Typing BestScore (แยกตาม level) ----------
app.get("/api/typing/best", auth, async (req, res) => {
  try {
    const level = String(req.query.level || "easy").toLowerCase();
    if (!["easy", "normal", "hard"].includes(level))
      return res.status(400).json({ error: "invalid level" });

    const u = await User.findById(req.user.sub).select("bestScores").lean();
    if (!u) return res.status(404).json({ error: "ไม่พบผู้ใช้" });

    res.json({ level, best: Number(u.bestScores?.[level] || 0) });
  } catch (err) {
    console.error("GET_BEST_ERROR:", err);
    res.status(500).json({ error: "โหลดคะแนนไม่สำเร็จ" });
  }
});

app.get("/api/typing/best/all", auth, async (req, res) => {
  try {
    const u = await User.findById(req.user.sub).select("bestScores").lean();
    if (!u) return res.status(404).json({ error: "ไม่พบผู้ใช้" });
    res.json(u.bestScores || { easy: 0, normal: 0, hard: 0 });
  } catch (err) {
    console.error("GET_BEST_ALL_ERROR:", err);
    res.status(500).json({ error: "โหลดคะแนนไม่สำเร็จ" });
  }
});

app.post("/api/typing/best", auth, async (req, res) => {
  try {
    const level = String(req.body?.level || "").toLowerCase();
    const score = Number(req.body?.score);
    if (!["easy", "normal", "hard"].includes(level))
      return res.status(400).json({ error: "invalid level" });
    if (!Number.isFinite(score) || score < 0)
      return res.status(400).json({ error: "invalid score" });

    const user = await User.findById(req.user.sub);
    if (!user) return res.status(404).json({ error: "ไม่พบผู้ใช้" });

    const curr = Number(user.bestScores?.[level] || 0);
    if (score > curr) {
      user.bestScores[level] = score;
      await user.save();
    }
    res.json({ level, best: user.bestScores[level] || 0 });
  } catch (err) {
    console.error("SET_BEST_ERROR:", err);
    res.status(500).json({ error: "อัปเดตคะแนนไม่สำเร็จ" });
  }
});

// ---------- Words Routes (มี auth+admin ในไฟล์ route) ----------
app.use("/api/words", wordRoutes);

// ---------- Seed (optional: POST /api/seed/words) ----------
app.post("/api/seed/words", auth, requireAdmin, async (req, res) => {
  try {
    const payload = req.body?.items || [];
    if (!Array.isArray(payload) || payload.length === 0) {
      return res.status(400).json({ error: "รูปแบบ payload ไม่ถูกต้อง" });
    }
    // payload: [{ term, level, hint? }, ...]
    const docs = await Word.insertMany(
      payload.map((x) => ({ term: String(x.term).trim(), level: x.level, hint: String(x.hint || "") })),
      { ordered: false }
    );
    res.json({ inserted: docs.length });
  } catch (err) {
    console.error("SEED_ERROR:", err);
    res.status(500).json({ error: "seed ไม่สำเร็จ" });
  }
});

app.get("/api/leaderboard", async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 10));

    const projectBase = { name: 1, "bestScores.easy": 1, "bestScores.normal": 1, "bestScores.hard": 1 };

    // ดึงทีเดียว แล้วแยกเรียงฝั่งเซิร์ฟง่าย ๆ
    const users = await mongoose.model("User").find({}, projectBase).lean();

    const sortTake = (arr, key) =>
      arr
        .map(u => ({ name: u.name, score: Number(u.bestScores?.[key] || 0) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    res.json({
      easy:   sortTake(users, "easy"),
      normal: sortTake(users, "normal"),
      hard:   sortTake(users, "hard"),
    });
  } catch (err) {
    console.error("LEADERBOARD_ERROR:", err);
    res.status(500).json({ error: "โหลด Leaderboard ไม่สำเร็จ" });
  }
});

// ---------- Start ----------
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
