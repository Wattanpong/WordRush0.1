// src/App.jsx
import { BrowserRouter, Routes, Route, NavLink, Link, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import AdminRoute from "./auth/AdminRoute";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import AdminWords from "./pages/AdminWords";
import TypingPractice from "./pages/TypingPractice";
import Leaderboard from "./pages/Leaderboard";

/* ============ Navbar ============ */
function Nav() {
  const { user, logout } = useAuth();

  return (
    <header style={styles.headerWrap}>
      <nav style={styles.nav}>
        <div style={styles.left}>
          <NavLink to="/" style={styles.brand}>
            WordRush
          </NavLink>
          <NavLink to="/leaderboard" style={styles.link}>อันดับ</NavLink>

        </div>

        <div style={styles.right}>
          {user ? (
            <>
              <NavLink to="/profile" style={styles.link}>โปรไฟล์</NavLink>
              {user.role === "admin" && (
                <NavLink to="/admin/words" style={styles.link}>Admin</NavLink>
              )}
              <button onClick={logout} style={styles.btnGhost}>ออกจากระบบ</button>
            </>
          ) : (
            <Link to="/login" style={styles.btnLogin}>Login</Link>
          )}
        </div>
      </nav>
    </header>
  );
}

/* ============ หน้าแรก ============ */
function Home() {
  return (
    <main style={styles.main}>
      <section style={styles.hero}>
        <h1 style={styles.heroTitle}>ฝึกพิมพ์ภาษาอังกฤษให้ไวและแม่น</h1>
        <p style={styles.heroDesc}>
          โหมดสะสมคะแนนต่อเนื่อง เลือกระดับ ง่าย/กลาง/ยาก
        </p>
        <div style={styles.heroActions}>
          <Link to="/practice" style={styles.cta}>เริ่มฝึกพิมพ์เลย →</Link>
        </div>
      </section>
    </main>
  );
}

/* ============ App Root ============ */
export default function App() {
  return (
    <AuthProvider>
      <div style={styles.layout}>
        <BrowserRouter>
          <Nav />

          <div style={styles.container}>
            <Routes>
              {/* สาธารณะ */}
              <Route path="/" element={<Home />} />
              <Route path="/practice" element={<TypingPractice />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/leaderboard" element={<Leaderboard />} />


              {/* เฉพาะผู้ที่ล็อกอิน */}
              <Route element={<ProtectedRoute />}>
                <Route path="/profile" element={<Profile />} />
              </Route>

              {/* เฉพาะผู้ดูแลระบบ */}
              <Route element={<AdminRoute />}>
                <Route path="/admin/words" element={<AdminWords />} />
              </Route>

              {/* redirect จากการพิมพ์ path ตามไฟล์ */}
              <Route path="/pages/AdminWords" element={<Navigate to="/admin/words" replace />} />

              {/* 404 */}
              <Route path="*" element={<div style={{ padding: 24 }}>ไม่พบหน้า</div>} />
            </Routes>
          </div>

          <footer style={styles.footer}>
            <div style={styles.footerInner}>
              <span>© 2025 WordRush</span>
              <span>ฝึกพิมพ์ • ฟังสำเนียง • เก็บสถิติ</span>
            </div>
          </footer>
        </BrowserRouter>
      </div>
    </AuthProvider>
  );
}

/* ============ Styles (น้ำเงิน/ขาว) ============ */
const styles = {
  layout: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#f9fafb",
  },
  container: {
    flex: 1,
    maxWidth: 1100,
    margin: "0 auto",
    padding: "24px 16px 80px",
  },
  headerWrap: {
    position: "sticky",
    top: 0,
    zIndex: 40,
    backdropFilter: "blur(12px)",
    background: "rgba(255,255,255,0.9)",
    borderBottom: "1px solid #e2e8f0",
  },
  nav: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "12px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  left: { display: "flex", alignItems: "center", gap: 20 },
  brand: {
    fontWeight: 900,
    textDecoration: "none",
    color: "#1e3a8a",
    fontSize: 20,
  },
  right: { display: "flex", alignItems: "center", gap: 10 },
  link: {
    textDecoration: "none",
    color: "#475569",
    padding: "8px 12px",
    borderRadius: 8,
    fontWeight: 600,
  },
  btnGhost: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    padding: "8px 14px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
    color: "#1e3a8a",
  },
  btnLogin: {
    background: "#1d4ed8",
    color: "#fff",
    padding: "8px 18px",
    borderRadius: 10,
    fontWeight: 700,
    textDecoration: "none",
    boxShadow: "0 4px 12px rgba(29,78,216,0.25)",
  },
  main: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    flexDirection: "column",
    minHeight: "60vh",
  },
  hero: {
    background: "#fff",
    borderRadius: 20,
    padding: "40px 30px",
    boxShadow: "0 12px 40px rgba(0,0,0,.05)",
    maxWidth: 720,
  },
  heroTitle: { fontSize: 32, fontWeight: 900, color: "#1e3a8a", marginBottom: 12 },
  heroDesc: { color: "#475569", marginBottom: 24 },
  heroActions: { display: "flex", justifyContent: "center" },
  cta: {
    display: "inline-block",
    background: "#1d4ed8",
    color: "#fff",
    padding: "12px 20px",
    borderRadius: 12,
    textDecoration: "none",
    fontWeight: 700,
    boxShadow: "0 8px 24px rgba(29,78,216,0.25)",
  },
  footer: {
    marginTop: "auto",
    background: "#1e3a8a",
    color: "#fff",
    padding: "16px 0",
  },
  footerInner: {
    maxWidth: 1100,
    margin: "0 auto",
    display: "flex",
    justifyContent: "space-between",
    padding: "0 16px",
    flexWrap: "wrap",
    gap: 10,
    fontSize: 14,
  },
};
