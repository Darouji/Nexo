import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  Inventario: {
    moduleKey: "inventario",
    fallbackRoles: READ_ROLES,
  },
  Kardex: {
    moduleKey: "inventario",
    fallbackRoles: READ_ROLES,
  },
  "Ventas / Ingresos": {
    moduleKey: "ventas",
    fallbackRoles: READ_ROLES,
  },
  "Compras / Egresos": {
    moduleKey: "compras",
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

const sectionPaths: Record<string, string> = {
  Inicio: "/inicio",
  Usuarios: "/usuarios",
  Colaboradores: "/colaboradores",
  "Entidades comerciales": "/entidades-comerciales",
  Inventario: "/inventario/catalogo",
  Kardex: "/kardex",
  "Ventas / Ingresos": "/ventas",
  "Compras / Egresos": "/compras",
  "Importaciones Excel": "/importaciones",
  Documentos: "/documentos",
  Estadísticas: "/estadisticas",
  Auditoría: "/auditoria",
};

const pathSections: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(sectionPaths).map(([section, path]) => [path, section]),
  ),
  "/inventario": "Inventario",
  "/inventario/por-recibir": "Compras / Egresos",
  "/compras/recepcion": "Compras / Egresos",
  "/inventario/ubicaciones": "Inventario",
};

function normalizePathname(pathname: string) {
  const normalizedPath = pathname.replace(/\/+$/, "");

  return normalizedPath || "/";
}

function getSectionFromPath(pathname: string) {
  const normalizedPath = normalizePathname(pathname);

  if (normalizedPath === "/") {
    return "Inicio";
  }

  return pathSections[normalizedPath] ?? "Inicio";
}

function getSectionPath(section: string) {
  return sectionPaths[section] ?? sectionPaths.Inicio;
}

function getSectionAccessRule(section: string) {
  return (
    sectionAccessRules[section] ?? {
      moduleKey: "inicio",
      fallbackRoles: READ_ROLES,
    }
  );
}

export function DashboardPage({ user, onLogout }: DashboardPageProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const activeSection = getSectionFromPath(location.pathname);

  const activeSectionPath = getSectionPath(activeSection);

  const accessRule = getSectionAccessRule(activeSection);

  useEffect(() => {
    const currentPath = normalizePathname(location.pathname);

    if (currentPath === "/inventario") {
      navigate("/inventario/catalogo", {
        replace: true,
      });
      return;
    }

    if (currentPath === "/inventario/por-recibir") {
      navigate("/compras/recepcion", {
        replace: true,
      });
      return;
    }

    if (!pathSections[currentPath]) {
      navigate(activeSectionPath, {
        replace: true,
      });
    }
  }, [activeSectionPath, location.pathname, navigate]);

  const handleSectionChange = (section: string) => {
    navigate(getSectionPath(section));
  };

  const handleLogout = async () => {
    await logout();
    navigate("/inicio", {
      replace: true,
    });

    onLogout();
  };

  const renderContent = () => {
    switch (activeSection) {
      case "Inicio":
        return <HomePage user={user} onSectionChange={handleSectionChange} />;

      case "Usuarios":
        return <UsersPage currentUser={user} />;

      case "Inventario":
        if (normalizePathname(location.pathname) === "/inventario/por-recibir") {
          return <ProductsPage section="pending-receipts" />;
        }

        if (normalizePathname(location.pathname) === "/inventario/ubicaciones") {
          return <ProductsPage section="locations" />;
        }

        return <ProductsPage section="catalog" />;

      case "Kardex":
        return <ProductsPage section="kardex" />;

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
      onSectionChange={handleSectionChange}
      onLogout={handleLogout}
    >
      <PermissionGate
        user={user}
        moduleKey={accessRule.moduleKey}
        fallbackRoles={accessRule.fallbackRoles}
        fallback={
          <PermissionDeniedState
            moduleLabel={activeSection}
            onBack={() => handleSectionChange("Inicio")}
          />
        }
      >
        {renderContent()}
      </PermissionGate>
    </AppLayout>
  );
}
