import { useState } from "react";
import { Typography } from "@mui/material";
import { AppLayout } from "../layouts/AppLayout";
import { HomePage } from "./HomePage";
import { ProductsPage } from "./ProductsPage";
import { PurchasesPage } from "./PurchasesPage";
import { getStoredUser, logout } from "../services/authService";
import { colors } from "../theme/colors";
import { SalesPage } from "./SalesPage";
import type { AuthUser } from "../types/auth";

interface DashboardPageProps {
  onLogout: () => void;
}

const fallbackUser: AuthUser = {
  id: 1,
  username: "Admin",
  email: "admin@serkan.cl",
  first_name: "Admin",
  last_name: "Sistema",
  full_name: "Admin Sistema",
  role: "ADMINISTRADOR",
  role_display: "Administrador",
  status: "ACTIVO",
  status_display: "Activo",
  is_active: true,
  is_staff: true,
  is_superuser: true,
  phone: "S/N",
  position: "Administrador",
  department: "Administración",
  observations: "",
};

export function DashboardPage({ onLogout }: DashboardPageProps) {
  const [activeSection, setActiveSection] = useState("Inicio");
  const user = (getStoredUser() as AuthUser | null) ?? fallbackUser;

  const handleLogout = () => {
    logout();
    onLogout();
  };

  const renderContent = () => {
    switch (activeSection) {
      case "Inicio":
        return <HomePage user={user} onSectionChange={setActiveSection} />;

      case "Productos":
        return <ProductsPage />;

      case "Ventas / Ingresos":
        return <SalesPage />;

      case "Compras / Egresos":
        return <PurchasesPage />;

      default:
        return (
          <Typography variant="h6" sx={{ color: colors.text.muted }}>
            El módulo "{activeSection}" se encuentra en construcción.
          </Typography>
        );
    }
  };

  return (
    <AppLayout
      user={user}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      onLogout={handleLogout}
    >
      {renderContent()}
    </AppLayout>
  );
}
