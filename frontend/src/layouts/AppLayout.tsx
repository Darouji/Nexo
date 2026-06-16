import {
  AppBar,
  Box,
  Button,
  Chip,
  Toolbar,
  Typography,
  Tabs,
  Tab,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import type { ReactNode } from "react";
import type { AuthUser } from "../types/auth";
import { getStoredAccess } from "../services/authService";
import { colors } from "../theme/colors";

type MenuItem = {
  label: string;
  moduleKey: string;
  fallbackRoles: string[];
};

const menuItems: MenuItem[] = [
  {
    label: "Inicio",
    moduleKey: "inicio",
    fallbackRoles: [
      "ADMINISTRADOR",
      "FINANZAS_COMERCIAL",
      "RRHH",
      "INFORMATICO",
      "OPERATIVO",
      "CONSULTA",
    ],
  },
  {
    label: "Usuarios",
    moduleKey: "usuarios",
    fallbackRoles: [
      "ADMINISTRADOR",
      "RRHH",
      "FINANZAS_COMERCIAL",
      "INFORMATICO",
    ],
  },
  {
    label: "Colaboradores",
    moduleKey: "colaboradores",
    fallbackRoles: [
      "ADMINISTRADOR",
      "RRHH",
      "FINANZAS_COMERCIAL",
      "INFORMATICO",
    ],
  },
  {
    label: "Entidades comerciales",
    moduleKey: "comercial",
    fallbackRoles: [
      "ADMINISTRADOR",
      "FINANZAS_COMERCIAL",
      "RRHH",
      "INFORMATICO",
      "OPERATIVO",
      "CONSULTA",
    ],
  },
  {
    label: "Productos",
    moduleKey: "inventario",
    fallbackRoles: [
      "ADMINISTRADOR",
      "FINANZAS_COMERCIAL",
      "RRHH",
      "INFORMATICO",
      "OPERATIVO",
      "CONSULTA",
    ],
  },
  {
    label: "Ventas / Ingresos",
    moduleKey: "ventas",
    fallbackRoles: [
      "ADMINISTRADOR",
      "FINANZAS_COMERCIAL",
      "OPERATIVO",
      "CONSULTA",
    ],
  },
  {
    label: "Importaciones Excel",
    moduleKey: "importaciones",
    fallbackRoles: ["ADMINISTRADOR", "FINANZAS_COMERCIAL", "INFORMATICO"],
  },
  {
    label: "Documentos",
    moduleKey: "documentos",
    fallbackRoles: [
      "ADMINISTRADOR",
      "FINANZAS_COMERCIAL",
      "RRHH",
      "INFORMATICO",
      "OPERATIVO",
      "CONSULTA",
    ],
  },
  {
    label: "Estadísticas",
    moduleKey: "estadisticas",
    fallbackRoles: [
      "ADMINISTRADOR",
      "FINANZAS_COMERCIAL",
      "RRHH",
      "INFORMATICO",
      "OPERATIVO",
      "CONSULTA",
    ],
  },
  {
    label: "Auditoría",
    moduleKey: "auditoria",
    fallbackRoles: ["ADMINISTRADOR", "INFORMATICO"],
  },
];

type AppLayoutProps = {
  user: AuthUser | null;
  activeSection: string;
  onSectionChange: (section: string) => void;
  onLogout: () => void;
  children: ReactNode;
};

export function AppLayout({
  user,
  activeSection,
  onSectionChange,
  onLogout,
  children,
}: AppLayoutProps) {
  const role = user?.role;
  const access = getStoredAccess();

  const visibleMenuItems = menuItems.filter((item) => {
    const permission = access?.permissions?.[item.moduleKey];

    if (permission) {
      return permission.can_view;
    }

    return role ? item.fallbackRoles.includes(role) : false;
  });

  const currentTabIndex = visibleMenuItems.findIndex(
    (item) => item.label === activeSection,
  );

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    if (newValue >= 0 && newValue < visibleMenuItems.length) {
      onSectionChange(visibleMenuItems[newValue].label);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Banner Superior Unificado */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          top: 0,
          zIndex: 1200,
          bgcolor: colors.background.header,
          borderBottom: `2px solid ${colors.border.light}`,
          backdropFilter: "blur(18px)",
        }}
      >
        <Toolbar sx={{ justifyContent: "space-between", py: 1, px: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Box>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 900,
                  color: colors.text.primary,
                  letterSpacing: "0.5px",
                }}
              >
                SERKAN
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: colors.primary.main,
                  fontWeight: 700,
                  tracking: 1,
                }}
              >
                V2 // CONTROL OPERATIVO
              </Typography>
            </Box>
          </Box>

          {/* Información del Usuario Conectado */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
            {user && (
              <Box sx={{ textAlign: "right" }}>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 700, color: colors.text.primary }}
                >
                  {user.first_name} {user.last_name}
                </Typography>
                <Chip
                  size="small"
                  label={user.role_display || user.role || "Sin rol"}
                  sx={{
                    color: colors.accent.main,
                    borderColor: colors.accent.border,
                    bgcolor: colors.accent.soft,
                    fontWeight: 700,
                    mt: 0.5,
                  }}
                  variant="outlined"
                />
              </Box>
            )}

            <Button
              variant="outlined"
              size="small"
              startIcon={<LogoutIcon />}
              onClick={onLogout}
              sx={{
                color: colors.status.error,
                borderColor: colors.status.error,
                fontWeight: 700,
                "&:hover": {
                  bgcolor: colors.status.errorSoft,
                  borderColor: colors.status.error,
                },
              }}
            >
              Salir
            </Button>
          </Box>
        </Toolbar>

        {/* Menú Horizontal de Pestañas Grandes y Claras */}
        <Box sx={{ px: 2, bgcolor: colors.background.main }}>
          <Tabs
            value={currentTabIndex >= 0 ? currentTabIndex : 0}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            textColor="inherit"
            indicatorColor="primary"
            sx={{
              "& .MuiTabs-indicator": {
                height: 3,
                bgcolor: colors.primary.main,
              },
              "& .MuiTab-root": {
                color: colors.text.secondary,
                fontWeight: 700,
                fontSize: "0.95rem",
                py: 2,
                px: 3,
                minHeight: 50,
                "&:hover": {
                  color: colors.text.primary,
                  bgcolor: colors.action.hover,
                },
                "&.Mui-selected": {
                  color: colors.primary.main,
                  bgcolor: colors.primary.activeTab,
                },
              },
            }}
          >
            {visibleMenuItems.map((item) => (
              <Tab key={item.label} label={item.label} />
            ))}
          </Tabs>
        </Box>
      </AppBar>

      {/* Espacio del Contenido Principal a ancho completo */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: "100%",
          px: { xs: 2, md: 3, xl: 4 },
          py: 3,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
