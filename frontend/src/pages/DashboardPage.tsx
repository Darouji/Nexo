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
import { PermissionGate } from "../components/PermissionGate";
import { PermissionDeniedState } from "../components/StateFeedback";
import type { AuthUser } from "../types/auth";

interface DashboardPageProps {
  user: AuthUser;
  onLogout: () => void;
}

type SectionAccessRule = {
  moduleKey: string;
  fallbackRoles: string[];
};

const READ_ROLES = [
  "ADMINISTRADOR",
  "FINANZAS_COMERCIAL",
  "RRHH",
  "INFORMATICO",
  "OPERATIVO",
  "CONSULTA",
];

const MANAGEMENT_ROLES = [
  "ADMINISTRADOR",
  "RRHH",
  "FINANZAS_COMERCIAL",
  "INFORMATICO",
];

const sectionAccessRules: Record<string, SectionAccessRule> = {
  Inicio: {
    moduleKey: "inicio",
    fallbackRoles: READ_ROLES,
  },
  Usuarios: {
    moduleKey: "usuarios",
    fallbackRoles: MANAGEMENT_ROLES,
  },
  Colaboradores: {
    moduleKey: "colaboradores",
    fallbackRoles: MANAGEMENT_ROLES,
  },
  "Entidades comerciales": {
    moduleKey: "comercial",
    fallbackRoles: READ_ROLES,
  },
  Productos: {
    moduleKey: "inventario",
    fallbackRoles: READ_ROLES,
  },
  "Ventas / Ingresos": {
    moduleKey: "ventas",
    fallbackRoles: READ_ROLES,
  },
  "Compras / Egresos": {
    moduleKey: "compras_demo",
    fallbackRoles: ["ADMINISTRADOR", "FINANZAS_COMERCIAL"],
  },
  "Importaciones Excel": {
    moduleKey: "importaciones",
    fallbackRoles: ["ADMINISTRADOR", "FINANZAS_COMERCIAL", "INFORMATICO"],
  },
  Documentos: {
    moduleKey: "documentos",
    fallbackRoles: READ_ROLES,
  },
  Estadísticas: {
    moduleKey: "estadisticas",
    fallbackRoles: READ_ROLES,
  },
  Auditoría: {
    moduleKey: "auditoria",
    fallbackRoles: ["ADMINISTRADOR", "INFORMATICO"],
  },
};

function getSectionAccessRule(section: string) {
  return (
    sectionAccessRules[section] ?? {
      moduleKey: "inicio",
      fallbackRoles: READ_ROLES,
    }
  );
}

export function DashboardPage({ user, onLogout }: DashboardPageProps) {
  const [activeSection, setActiveSection] = useState("Inicio");
  const accessRule = getSectionAccessRule(activeSection);

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
      <PermissionGate
        user={user}
        moduleKey={accessRule.moduleKey}
        fallbackRoles={accessRule.fallbackRoles}
        fallback={
          <PermissionDeniedState
            moduleLabel={activeSection}
            onBack={() => setActiveSection("Inicio")}
          />
        }
      >
        {renderContent()}
      </PermissionGate>
    </AppLayout>
  );
}
