import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiGet, apiPut, apiPost } from "../api";

export default function Profile() {
  const { token, user, setUser, logout } = useAuth();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pwChanging, setPwChanging] = useState(false);

  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ name: "", email: "" });
  const [pwForm, setPwForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirm: "",
  });

  const initials = useMemo(() => {
    const n = (user?.name || "").trim();
    if (!n) return "U";
    const parts = n.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || "";
    const last = parts[1]?.[0] || "";
    return (first + last || first).toUpperCase();
  }, [user?.name]);

  // ---- helpers ----
  const clearFlash = () => {
    setError("");
    setOk("");
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setOk("คัดลอกแล้ว");
      setTimeout(() => setOk(""), 1500);
    } catch {
      setError("คัดลอกไม่สำเร็จ");
      setTimeout(() => setError(""), 1500);
    }
  };

  const loadMe = async () => {
    if (!token) return;
    clearFlash();
    try {
      setLoading(true);
      const me = await apiGet("/api/me", token);
      setUser(me);
      setForm({ name: me?.name || "", email: me?.email || "" });
    } catch (e) {
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ---- actions ----
  const onSave = async (e) => {
    e.preventDefault();
    clearFlash();
    if (!form.name?.trim()) {
      setError("กรุณากรอกชื่อ");
      return;
    }
    try {
      setSaving(true);
      const updated = await apiPut("/api/me", form, token);
      setUser(updated);
      setOk("บันทึกข้อมูลแล้ว");
      setEditMode(false);
    } catch (e) {
      setError(e?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const onChangePassword = async (e) => {
    e.preventDefault();
    clearFlash();
    if (!pwForm.oldPassword || !pwForm.newPassword) {
      setError("กรุณากรอกรหัสผ่านให้ครบ");
      return;
    }
    if (pwForm.newPassword.length < 6) {
      setError("รหัสผ่านใหม่ต้องอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (pwForm.newPassword !== pwForm.confirm) {
      setError("รหัสผ่านใหม่ไม่ตรงกัน");
      return;
    }
    try {
      setPwChanging(true);
      await apiPost(
        "/api/change-password",
        {
          oldPassword: pwForm.oldPassword,
          newPassword: pwForm.newPassword,
        },
        token
      );
      setOk("เปลี่ยนรหัสผ่านสำเร็จ");
      setPwForm({ oldPassword: "", newPassword: "", confirm: "" });
    } catch (e) {
      setError(e?.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    } finally {
      setPwChanging(false);
    }
  };

  if (!token) {
    return (
      <div style={S.wrap}>
        <div style={S.card}>
          <div style={S.titleRow}>
            <h2 style={S.h2}>โปรไฟล์ผู้ใช้</h2>
          </div>
          <div style={S.blankBox}>กรุณาเข้าสู่ระบบ</div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        {/* Header */}
        <div style={S.titleRow}>
          <h2 style={S.h2}>โปรไฟล์ผู้ใช้</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.btnGhost} onClick={loadMe} disabled={loading}>
              {loading ? "กำลังโหลด..." : "Refresh"}
            </button>
            <button style={S.btnDanger} onClick={logout}>
              ออกจากระบบ
            </button>
          </div>
        </div>

        {/* Alerts */}
        <div style={{ minHeight: 28, marginBottom: 8 }}>
          {error && <div style={S.alertError}>{error}</div>}
          {ok && <div style={S.alertOk}>{ok}</div>}
        </div>

        {/* Basic Info */}
        <div style={S.profileTop}>
          <div style={S.avatar}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.kvRow}>
              <div style={S.k}>ชื่อ</div>
              <div style={S.v}>
                {loading ? <Skeleton w={120} /> : user?.name || "-"}
              </div>
            </div>
            <div style={S.kvRow}>
              <div style={S.k}>อีเมล</div>
              <div style={S.vWrap}>
                <div style={S.v}>
                  {loading ? <Skeleton w={180} /> : user?.email || "-"}
                </div>
                {!!user?.email && (
                  <button style={S.badge} onClick={() => copy(user.email)}>
                    คัดลอก
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Edit Section */}
        <div style={S.section}>
          <div style={S.sectionHead}>
            <h3 style={S.h3}>แก้ไขข้อมูล</h3>
            {!editMode ? (
              <button style={S.btn} onClick={() => setEditMode(true)}>
                แก้ไข
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  style={S.btnGhost}
                  onClick={() => {
                    setEditMode(false);
                    setForm({
                      name: user?.name || "",
                      email: user?.email || "",
                    });
                  }}
                >
                  ยกเลิก
                </button>
                <button
                  style={S.btn}
                  onClick={onSave}
                  disabled={saving}
                >
                  {saving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            )}
          </div>

          <div style={S.formGrid}>
            <label style={S.label}>
              <div style={S.labelText}>ชื่อ</div>
              <input
                style={S.input}
                value={form.name}
                disabled={!editMode}
                onChange={(e) =>
                  setForm((s) => ({ ...s, name: e.target.value }))
                }
                placeholder="กรอกชื่อ"
              />
            </label>
            <label style={S.label}>
              <div style={S.labelText}>อีเมล</div>
              <input
                style={S.input}
                value={form.email}
                disabled
                onChange={(e) =>
                  setForm((s) => ({ ...s, email: e.target.value }))
                }
                placeholder="example@email.com"
              />
              <div style={S.hint}>
                หากต้องการเปลี่ยนอีเมล ควรทำผ่านขั้นตอนยืนยันอีเมลใหม่
              </div>
            </label>
          </div>
        </div>

        {/* Change Password */}
        <div style={S.section}>
          <div style={S.sectionHead}>
            <h3 style={S.h3}>เปลี่ยนรหัสผ่าน</h3>
          </div>
          <form onSubmit={onChangePassword} style={S.formGrid}>
            <label style={S.label}>
              <div style={S.labelText}>รหัสผ่านเดิม</div>
              <input
                style={S.input}
                type="password"
                value={pwForm.oldPassword}
                onChange={(e) =>
                  setPwForm((s) => ({ ...s, oldPassword: e.target.value }))
                }
                placeholder="รหัสผ่านเดิม"
              />
            </label>
            <label style={S.label}>
              <div style={S.labelText}>รหัสผ่านใหม่</div>
              <input
                style={S.input}
                type="password"
                value={pwForm.newPassword}
                onChange={(e) =>
                  setPwForm((s) => ({ ...s, newPassword: e.target.value }))
                }
                placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)"
              />
            </label>
            <label style={S.label}>
              <div style={S.labelText}>ยืนยันรหัสผ่านใหม่</div>
              <input
                style={S.input}
                type="password"
                value={pwForm.confirm}
                onChange={(e) =>
                  setPwForm((s) => ({ ...s, confirm: e.target.value }))
                }
                placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง"
              />
            </label>
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                style={S.btnGhost}
                onClick={() =>
                  setPwForm({ oldPassword: "", newPassword: "", confirm: "" })
                }
              >
                ล้าง
              </button>
              <button
                type="submit"
                style={S.btn}
                disabled={pwChanging}
              >
                {pwChanging ? "กำลังเปลี่ยน..." : "ยืนยัน"}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div style={S.footerNote}>
          เคล็ดลับ: ถ้า “หน้าสั่น” ระหว่างโหลด ข้อความด้านบนเราได้กันพื้นที่ไว้
          (minHeight) เพื่อลด layout shift แล้ว
        </div>
      </div>
    </div>
  );
}

/* ================= Styles ================= */
const S = {
  wrap: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start", // ชิดบน
    background: "#f8fafc",
    padding: 16,
    paddingTop: 24,
  },
  card: {
    width: "min(760px, 92vw)",
    background: "#fff",
    padding: 24,
    borderRadius: 16,
    boxShadow: "0 8px 28px rgba(2,6,23,0.08)",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 8,
  },
  h2: { margin: 0, fontSize: 22, color: "#0f172a" },
  h3: { margin: 0, fontSize: 18, color: "#0f172a" },
  alertOk: {
    background: "#ecfdf5",
    color: "#065f46",
    border: "1px solid #a7f3d0",
    padding: "8px 12px",
    borderRadius: 10,
    fontSize: 14,
  },
  alertError: {
    background: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    padding: "8px 12px",
    borderRadius: 10,
    fontSize: 14,
  },
  profileTop: {
    display: "flex",
    gap: 16,
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid #e5e7eb",
    marginBottom: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 999,
    background: "linear-gradient(135deg,#34d399,#10b981)",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    fontWeight: 700,
    fontSize: 24,
    boxShadow: "0 6px 18px rgba(16,185,129,0.35)",
  },
  kvRow: { display: "flex", alignItems: "center", gap: 8, margin: "6px 0" },
  k: { width: 68, color: "#64748b", fontSize: 14 },
  v: { color: "#0f172a", fontSize: 15, wordBreak: "break-word" },
  vWrap: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  badge: {
    padding: "4px 8px",
    borderRadius: 8,
    fontSize: 12,
    border: "1px solid #d1fae5",
    background: "#ecfdf5",
    color: "#065f46",
    cursor: "pointer",
  },
  section: { padding: "12px 0", borderBottom: "1px solid #e5e7eb" },
  sectionHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 8,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  label: { display: "flex", flexDirection: "column", gap: 6 },
  labelText: { fontSize: 14, color: "#334155" },
  input: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    outline: "none",
    fontSize: 14,
  },
  hint: { fontSize: 12, color: "#64748b", marginTop: 6 },
  btn: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #059669",
    background: "#10b981",
    color: "#fff",
    cursor: "pointer",
  },
  btnGhost: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#0f172a",
    cursor: "pointer",
  },
  btnDanger: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #dc2626",
    background: "#ef4444",
    color: "#fff",
    cursor: "pointer",
  },
  blankBox: {
    padding: 16,
    background: "#f1f5f9",
    borderRadius: 12,
    textAlign: "center",
    color: "#475569",
  },
  footerNote: { fontSize: 12, color: "#64748b", marginTop: 12 },
};

function Skeleton({ w = 100, h = 16 }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: w,
        height: h,
        borderRadius: 6,
        background:
          "linear-gradient(90deg, #f1f5f9, #e2e8f0, #f1f5f9)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.2s infinite",
      }}
    />
  );
}
