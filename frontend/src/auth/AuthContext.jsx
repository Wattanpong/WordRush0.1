import { createContext, useContext, useEffect, useState } from "react";
import { apiGet } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("auth:token") || "");
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("auth:user") || "null"); }
    catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  const saveAuth = (t, u) => {
    setToken(t);
    setUser(u);
    if (t) localStorage.setItem("auth:token", t); else localStorage.removeItem("auth:token");
    if (u) localStorage.setItem("auth:user", JSON.stringify(u)); else localStorage.removeItem("auth:user");
  };

  const logout = () => saveAuth("", null);

  // โหลด /api/me เมื่อมี token (กันกรณีรีเฟรชหน้า)
  useEffect(() => {
    (async () => {
      if (!token || user) return;
      try {
        setLoading(true);
        const me = await apiGet("/api/me", token);
        setUser(me);
      } catch (e) {
        logout();
      } finally {
        setLoading(false);
      }
    })();
  }, [token]); // eslint-disable-line

  return (
    <AuthContext.Provider value={{ token, user, setUser, saveAuth, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
