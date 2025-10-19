// src/auth/AdminRoute.jsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function AdminRoute() {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />;
  if (user.role !== "admin") return <Navigate to="/" replace />;
  return <Outlet />;
}
