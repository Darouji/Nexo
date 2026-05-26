import { useState } from "react";
import { DashboardPage } from "../pages/DashboardPage";
import { LoginPage } from "../pages/LoginPage";
import { isAuthenticated } from "../services/authService";

export function AppRoutes() {
  const [authenticated, setAuthenticated] = useState(isAuthenticated());

  if (!authenticated) {
    return <LoginPage onLoginSuccess={() => setAuthenticated(true)} />;
  }

  return <DashboardPage onLogout={() => setAuthenticated(false)} />;
}