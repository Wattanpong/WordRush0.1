// middleware/auth.js
export default function auth(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: "unauthorized" });

    // ถอด JWT ตามจริงของคุณ
    const payload = /* jwt.verify(token, SECRET) */ { id: "demo-user-id" };

    req.user = { id: String(payload.id) };
    next();
  } catch {
    res.status(401).json({ error: "unauthorized" });
  }
}
