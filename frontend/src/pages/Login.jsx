import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiPost } from "../api";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { saveAuth } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const data = await apiPost("/api/auth/login", form);
      saveAuth(data.token, data.user);
      navigate("/");
    } catch (err) {
      try {
        const parsed = JSON.parse(err.message);
        setError(parsed.error || "เข้าสู่ระบบไม่สำเร็จ");
      } catch {
        setError("เข้าสู่ระบบไม่สำเร็จ");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h2 style={styles.title}>เข้าสู่ระบบ</h2>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={onSubmit} style={styles.form}>
          <input style={styles.input} type="email" name="email" placeholder="อีเมล" value={form.email} onChange={onChange} required />
          <input style={styles.input} type="password" name="password" placeholder="รหัสผ่าน" value={form.password} onChange={onChange} required />
          <button style={styles.btn} disabled={loading}>{loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}</button>
        </form>
        <p style={styles.note}>ยังไม่มีบัญชี? <Link to="/register">สมัครสมาชิก</Link></p>
      </div>
    </div>
  );
}

const styles = {
  wrap: { minHeight: "100vh", display: "grid", placeItems: "center", background: "#f8fafc" },
  card: { width: 360, background: "#fff", padding: 24, borderRadius: 16, boxShadow: "0 6px 24px rgba(0,0,0,0.08)" },
  title: { margin: "0 0 16px 0", textAlign: "center" },
  form: { display: "grid", gap: 12 },
  input: { padding: 12, borderRadius: 10, border: "1px solid #e5e7eb" },
  btn: { padding: 12, borderRadius: 10, border: "none", background: "#22c55e", color: "#fff", cursor: "pointer" },
  note: { marginTop: 12, fontSize: 14, color: "#475569", textAlign: "center" },
  error: { background: "#fee2e2", color: "#b91c1c", padding: 10, borderRadius: 8, marginBottom: 8, fontSize: 14 }
};
