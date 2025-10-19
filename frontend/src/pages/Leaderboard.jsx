// src/pages/Leaderboard.jsx
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../api";
import { useAuth } from "../auth/AuthContext";

const LV_META = {
  easy:   { label: "ง่าย", color: "#1e3a8a" },
  normal: { label: "กลาง", color: "#0f766e" },
  hard:   { label: "ยาก", color: "#b45309" },
};

const medals = ["🥇", "🥈", "🥉"];

export default function Leaderboard() {
  const { user } = useAuth?.() ?? {};
  const [data, setData] = useState({ easy: [], normal: [], hard: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await apiGet("/api/leaderboard");
        if (mounted) setData(res || { easy: [], normal: [], hard: [] });
      } catch {
        setErr("โหลด Leaderboard ไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, []);

  const grids = useMemo(
    () => ([
      { key: "easy",   items: data.easy   || [] },
      { key: "normal", items: data.normal || [] },
      { key: "hard",   items: data.hard   || [] },
    ]),
    [data]
  );

  return (
    <main style={styles.page}>
      <h1 style={styles.h1}>🏆 Leaderboard — ทุกระดับ</h1>
      <p style={styles.sub}>แสดงอันดับคะแนนสูงสุดแยกตามระดับ (ไม่มีกรอบ/เส้น) • อัปเดตเมื่อผู้เล่นทำลายสถิติ</p>

      {err && <div style={styles.error}>{err}</div>}
      {loading ? (
        <div style={styles.loading}>กำลังโหลด...</div>
      ) : (
        <section style={styles.grid}>
          {grids.map(({ key, items }) => (
            <LevelBoard
              key={key}
              title={`ระดับ${LV_META[key].label}`}
              color={LV_META[key].color}
              items={items}
              currentName={user?.name}
            />
          ))}
        </section>
      )}
    </main>
  );
}

function LevelBoard({ title, color, items, currentName }) {
  return (
    <div style={{ ...styles.level, background: "transparent"}}>
      <h2 style={{ ...styles.levelTitle, color }}>{title}</h2>
      {items.length === 0 ? (
        <div style={styles.empty}>ยังไม่มีคนทำคะแนน</div>
      ) : (
        <ol style={styles.list}>
          {items.map((row, i) => {
            const isYou = currentName && row.name === currentName;
            const badge = medals[i] || `${i + 1}.`;
            return (
              <li key={`${row.name}-${i}`} style={styles.item}>
                <div style={styles.left}>
                  <span style={styles.badge}>{badge}</span>
                  <span style={{ ...styles.name, ...(isYou ? styles.you : {}) }}>
                    {row.name}{isYou ? " (คุณ)" : ""}
                  </span>
                </div>
                <div style={styles.score}>
                  {row.score}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/* ===== styles ===== */
const styles = {
  page: {
    maxWidth: 1100, margin: "0 auto", padding: "24px 16px 32px",
    background: "#f9fafb"
  },
  h1: { fontSize: 28, fontWeight: 900, color: "#1e3a8a", margin: 0 },
  sub: { color: "#475569", marginTop: 6, marginBottom: 18 },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
    gap: 20,
  },

  level: {
    padding: 8,
  },
  levelTitle: {
    fontSize: 20, fontWeight: 900, marginBottom: 8,
  },

  list: { listStyle: "none", padding: 0, margin: 0 },
  item: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "10px 12px",
    background: "#ffffff",
    borderRadius: 12,
  },
  left: { display: "flex", alignItems: "center", gap: 10 },
  badge: { width: 28, display: "inline-block", textAlign: "center", fontSize: 18 },
  name: { fontWeight: 700, color: "#0f172a" },
  you: {
    color: "#1d4ed8",
    textShadow: "0 0 0 transparent",
  },
  score: { fontWeight: 900, color: "#1e3a8a" },

  empty: { color: "#64748b", padding: "6px 0" },
  loading: { color: "#475569", padding: "8px 0" },
};

/* responsive */
styles.grid["@media (min-width: 768px)"] = undefined;
