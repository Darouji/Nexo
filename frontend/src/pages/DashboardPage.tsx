import { useState } from "react";
import { AppLayout } from "../layouts/AppLayout";
import { ProductsPage } from "./ProductsPage";
import { Typography } from "@mui/material";
import { colors } from "../theme/colors";
import type { AuthUser } from "../types/auth"; // Importación necesaria para el tipado

interface DashboardPageProps {
  onLogout: () => void;
}

export function DashboardPage({ onLogout }: DashboardPageProps) {
  const [activeSection, setActiveSection] = useState("Productos");

  // Usuario de prueba tipado para evitar bloqueos del compilador
  const mockUser = {
    id: 1,
    username: "Admin",
    email: "admin@serkan.cl",
    first_name: "Admin",
    last_name: "Sistema",
    full_name: "Admin Sistema",
    is_active: true,
    profile: {
      id: 1,
      role: "ADMINISTRADOR",
      role_display: "Administrador Global",
      is_active_profile: true,
      phone: "S/N",
      position: "Administrador",
    },
  } as unknown as AuthUser; // <--- Soluciona el error TS2322

  // Motor de renderizado dinámico según el menú seleccionado
  const renderContent = () => {
    switch (activeSection) {
      case "Productos":
        return <ProductsPage />;
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
      user={mockUser}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      onLogout={onLogout}
    >
      {renderContent()}
    </AppLayout>
  );
}
