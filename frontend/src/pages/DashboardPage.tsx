import { useState } from "react";
import { Typography } from "@mui/material";
import { AppLayout } from "../layouts/AppLayout";
import { HomePage } from "./HomePage";
import { ProductsPage } from "./ProductsPage";
import { PurchasesPage } from "./PurchasesPage";
import { logout } from "../services/authService";
import { colors } from "../theme/colors";
import { SalesPage } from "./SalesPage";
import { CommercialPage } from "./CommercialPage";
import { StatisticsPage } from "./StatisticsPage";
import { DocumentsPage } from "./DocumentsPage";
import { ImportsPage } from "./ImportsPage";
import { CollaboratorsPage } from "./CollaboratorsPage";
import { UsersPage } from "./UsersPage";
import { AuditPage } from "./AuditPage";
import type { AuthUser } from "../types/auth";

interface DashboardPageProps {
  user: AuthUser;
  onLogout: () => void;
}

export function DashboardPage({ user, onLogout }: DashboardPageProps) {
  const [activeSection, setActiveSection] = useState("Inicio");

  const handleLogout = async () => {
    await logout();
    onLogout();
  };

  const renderContent = () => {
    switch (activeSection) {
      case "Inicio":
        return <HomePage user={user} onSectionChange={setActiveSection} />;

      case "Usuarios":
        return <UsersPage currentUser={user} />;

      case "Productos":
        return <ProductsPage />;

      case "Ventas / Ingresos":
        return <SalesPage />;

      case "Compras / Egresos":
        return <PurchasesPage />;

      case "Entidades comerciales":
        return <CommercialPage />;

      case "Estadísticas":
        return <StatisticsPage />;

      case "Documentos":
        return <DocumentsPage />;

      case "Importaciones Excel":
        return <ImportsPage />;

      case "Colaboradores":
        return <CollaboratorsPage />;

      case "Auditoría":
        return <AuditPage />;

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
