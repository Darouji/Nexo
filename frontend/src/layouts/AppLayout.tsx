import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Toolbar,
  Typography,
  Tabs,
  Tab,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import type { ReactNode } from "react";
import type { AuthUser } from "../types/auth";
import { colors } from "../theme/colors";

const menuItems = [
  {
    label: "Dashboard",
    roles: [
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
    roles: ["ADMINISTRADOR", "RRHH", "FINANZAS_COMERCIAL", "INFORMATICO"],
  },
  {
    label: "Colaboradores",
    roles: ["ADMINISTRADOR", "RRHH", "FINANZAS_COMERCIAL", "INFORMATICO"],
  },
  {
    label: "Clientes",
    roles: ["ADMINISTRADOR", "FINANZAS_COMERCIAL", "RRHH", "INFORMATICO"],
  },
  {
    label: "Productos",
    roles: ["ADMINISTRADOR", "FINANZAS_COMERCIAL", "RRHH", "INFORMATICO"],
  },
  {
    label: "Ventas / Ingresos",
    roles: ["ADMINISTRADOR", "FINANZAS_COMERCIAL"],
  },
  {
    label: "Compras / Egresos",
    roles: ["ADMINISTRADOR", "FINANZAS_COMERCIAL"],
  },
  {
    label: "Importaciones Excel",
    roles: ["ADMINISTRADOR", "FINANZAS_COMERCIAL"],
  },
  {
    label: "Documentos",
    roles: [
      "ADMINISTRADOR",
      "FINANZAS_COMERCIAL",
      "RRHH",
      "INFORMATICO",
      "OPERATIVO",
    ],
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
  const role = user?.profile?.role;

  const visibleMenuItems = menuItems.filter((item) =>
    role ? item.roles.includes(role) : false,
  );

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
        position="static"
        elevation={0}
        sx={{
          bgcolor: colors.background.header,
          borderBottom: `2px solid ${colors.border.light}`,
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
                  label={user.profile?.role_display || "Sin rol"}
                  sx={{
                    color: colors.accent.main,
                    borderColor: colors.accent.main,
                    bgcolor: "rgba(0, 255, 136, 0.05)",
                    fontWeight: 700,
                    borderRadius: 0,
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
                borderRadius: 0,
                fontWeight: 700,
                "&:hover": {
                  bgcolor: "rgba(255, 0, 85, 0.08)",
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
                  bgcolor: "rgba(255, 255, 255, 0.02)",
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

      {/* Espacio del Contenido Principal Expandido */}
      <Box component="main" sx={{ flexGrow: 1, py: 4 }}>
        <Container maxWidth="xl">{children}</Container>
      </Box>
    </Box>
  );
}
