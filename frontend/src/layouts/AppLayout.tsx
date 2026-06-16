import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AppBar,
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import AssessmentIcon from "@mui/icons-material/Assessment";
import BusinessIcon from "@mui/icons-material/Business";
import CloseIcon from "@mui/icons-material/Close";
import DescriptionIcon from "@mui/icons-material/Description";
import GroupsIcon from "@mui/icons-material/Groups";
import HomeIcon from "@mui/icons-material/Home";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import SecurityIcon from "@mui/icons-material/Security";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import type { AuthUser } from "../types/auth";
import { colors } from "../theme/colors";

const drawerWidth = 294;

type MenuItem = {
  label: string;
  roles: string[];
  icon: ReactNode;
  helper: string;
  accent: {
    main: string;
    soft: string;
    border: string;
  };
};

const menuItems: MenuItem[] = [
  {
    label: "Inicio",
    roles: [
      "ADMINISTRADOR",
      "FINANZAS_COMERCIAL",
      "RRHH",
      "INFORMATICO",
      "OPERATIVO",
      "CONSULTA",
    ],
    icon: <HomeIcon />,
    helper: "Panel general",
    accent: colors.primary,
  },
  {
    label: "Usuarios",
    roles: ["ADMINISTRADOR", "RRHH", "FINANZAS_COMERCIAL", "INFORMATICO"],
    icon: <PeopleAltIcon />,
    helper: "Cuentas internas",
    accent: colors.modules.audit,
  },
  {
    label: "Colaboradores",
    roles: ["ADMINISTRADOR", "RRHH", "FINANZAS_COMERCIAL", "INFORMATICO"],
    icon: <GroupsIcon />,
    helper: "Personas SERKAN",
    accent: colors.modules.collaborators,
  },
  {
    label: "Entidades comerciales",
    roles: ["ADMINISTRADOR", "FINANZAS_COMERCIAL", "RRHH", "INFORMATICO"],
    icon: <BusinessIcon />,
    helper: "Holding, minera y contactos",
    accent: colors.modules.commercial,
  },
  {
    label: "Productos",
    roles: ["ADMINISTRADOR", "FINANZAS_COMERCIAL", "RRHH", "INFORMATICO"],
    icon: <Inventory2Icon />,
    helper: "Inventario y Kardex",
    accent: colors.modules.inventory,
  },
  {
    label: "Ventas / Ingresos",
    roles: ["ADMINISTRADOR", "FINANZAS_COMERCIAL"],
    icon: <PointOfSaleIcon />,
    helper: "Ventas y alertas",
    accent: colors.modules.sales,
  },
  {
    label: "Compras / Egresos",
    roles: ["ADMINISTRADOR", "FINANZAS_COMERCIAL"],
    icon: <ShoppingCartIcon />,
    helper: "Compras y costos",
    accent: colors.modules.purchases,
  },
  {
    label: "Importaciones Excel",
    roles: ["ADMINISTRADOR", "FINANZAS_COMERCIAL"],
    icon: <UploadFileIcon />,
    helper: "Carga masiva",
    accent: colors.modules.excel,
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
    icon: <DescriptionIcon />,
    helper: "Archivos y versiones",
    accent: colors.modules.documents,
  },
  {
    label: "Estadísticas",
    roles: [
      "ADMINISTRADOR",
      "FINANZAS_COMERCIAL",
      "RRHH",
      "INFORMATICO",
      "OPERATIVO",
      "CONSULTA",
    ],
    icon: <AssessmentIcon />,
    helper: "Indicadores",
    accent: colors.modules.analytics,
  },
  {
    label: "Auditoría",
    roles: ["ADMINISTRADOR", "INFORMATICO"],
    icon: <SecurityIcon />,
    helper: "Trazabilidad",
    accent: colors.modules.audit,
  },
];

type AppLayoutProps = {
  user: AuthUser | null;
  activeSection: string;
  onSectionChange: (section: string) => void;
  onLogout: () => void;
  children: ReactNode;
};

function getUserDisplayName(user: AuthUser | null) {
  if (!user) {
    return "Usuario";
  }

  const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();

  return fullName || user.full_name || user.username;
}

function SidebarContent({
  user,
  activeSection,
  visibleMenuItems,
  onSectionChange,
  onLogout,
  onClose,
}: {
  user: AuthUser | null;
  activeSection: string;
  visibleMenuItems: MenuItem[];
  onSectionChange: (section: string) => void;
  onLogout: () => void;
  onClose?: () => void;
}) {
  const handleItemClick = (section: string) => {
    onSectionChange(section);
    onClose?.();
  };

  return (
    <Stack
      sx={{
        height: "100%",
        bgcolor: colors.background.header,
        borderRight: `1px solid ${colors.border.light}`,
      }}
    >
      <Box
        sx={{
          px: 2.4,
          py: 2.4,
          borderBottom: `1px solid ${colors.border.light}`,
        }}
      >
        <Stack direction="row" spacing={1.4} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              display: "grid",
              placeItems: "center",
              borderRadius: colors.radius.md,
              color: colors.primary.main,
              bgcolor: colors.primary.soft,
              border: `1px solid ${colors.primary.border}`,
            }}
          >
            <AdminPanelSettingsIcon />
          </Box>

          <Box>
            <Typography
              variant="h5"
              sx={{
                color: colors.text.primary,
                fontWeight: 950,
                letterSpacing: "0.02em",
                lineHeight: 1,
              }}
            >
              SERKAN
            </Typography>

            <Typography
              variant="caption"
              sx={{
                color: colors.primary.main,
                fontWeight: 850,
                letterSpacing: "0.09em",
              }}
            >
              V2 CONTROL OPERATIVO
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box sx={{ px: 1.4, py: 1.4, flex: 1, overflowY: "auto" }}>
        <Stack spacing={0.7}>
          {visibleMenuItems.map((item) => {
            const selected = item.label === activeSection;

            return (
              <Button
                key={item.label}
                fullWidth
                onClick={() => handleItemClick(item.label)}
                sx={{
                  minHeight: 56,
                  px: 1.4,
                  py: 1,
                  justifyContent: "flex-start",
                  textAlign: "left",
                  borderRadius: colors.radius.md,
                  color: selected ? item.accent.main : colors.text.secondary,
                  bgcolor: selected ? item.accent.soft : "transparent",
                  border: `1px solid ${
                    selected ? item.accent.border : "transparent"
                  }`,
                  textTransform: "none",
                  "&:hover": {
                    bgcolor: selected ? item.accent.soft : colors.action.hover,
                    color: selected ? item.accent.main : colors.text.primary,
                  },
                }}
              >
                <Stack direction="row" spacing={1.25} sx={{ width: "100%" }}>
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                      borderRadius: colors.radius.sm,
                      color: selected ? item.accent.main : colors.text.muted,
                      bgcolor: selected
                        ? colors.background.paper
                        : colors.action.muted,
                      "& svg": { fontSize: 21 },
                    }}
                  >
                    {item.icon}
                  </Box>

                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: selected
                          ? item.accent.main
                          : colors.text.primary,
                        fontWeight: selected ? 950 : 800,
                        lineHeight: 1.2,
                      }}
                    >
                      {item.label}
                    </Typography>

                    <Typography
                      variant="caption"
                      sx={{
                        color: colors.text.muted,
                        display: "block",
                        lineHeight: 1.25,
                      }}
                    >
                      {item.helper}
                    </Typography>
                  </Box>
                </Stack>
              </Button>
            );
          })}
        </Stack>
      </Box>

      <Box
        sx={{
          p: 1.6,
          borderTop: `1px solid ${colors.border.light}`,
        }}
      >
        {user ? (
          <Box
            sx={{
              p: 1.5,
              mb: 1.2,
              borderRadius: colors.radius.md,
              bgcolor: colors.background.paper,
              border: `1px solid ${colors.border.light}`,
            }}
          >
            <Typography
              variant="body2"
              sx={{ color: colors.text.primary, fontWeight: 900 }}
            >
              {getUserDisplayName(user)}
            </Typography>

            <Typography
              variant="caption"
              sx={{ color: colors.text.muted, display: "block", mb: 1 }}
            >
              {user.email || user.username}
            </Typography>

            <Chip
              size="small"
              label={user.role_display || user.role || "Sin rol"}
              variant="outlined"
              sx={{
                color: colors.accent.main,
                bgcolor: colors.accent.soft,
                borderColor: colors.accent.border,
                fontWeight: 800,
              }}
            />
          </Box>
        ) : null}

        <Button
          fullWidth
          variant="outlined"
          startIcon={<LogoutIcon />}
          onClick={onLogout}
          sx={{
            color: colors.status.error,
            borderColor: colors.status.error,
            fontWeight: 850,
            "&:hover": {
              bgcolor: colors.status.errorSoft,
              borderColor: colors.status.error,
            },
          }}
        >
          Salir
        </Button>
      </Box>
    </Stack>
  );
}

export function AppLayout({
  user,
  activeSection,
  onSectionChange,
  onLogout,
  children,
}: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = user?.role;

  const visibleMenuItems = useMemo(
    () =>
      menuItems.filter((item) => (role ? item.roles.includes(role) : false)),
    [role],
  );

  const activeMenuItem =
    visibleMenuItems.find((item) => item.label === activeSection) ??
    visibleMenuItems[0];

  const handleDrawerClose = () => {
    setMobileOpen(false);
  };

  const drawerContent = (
    <SidebarContent
      user={user}
      activeSection={activeSection}
      visibleMenuItems={visibleMenuItems}
      onSectionChange={onSectionChange}
      onLogout={onLogout}
      onClose={() => setMobileOpen(false)}
    />
  );

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: colors.background.main,
        display: "flex",
      }}
    >
      <Box
        component="nav"
        sx={{
          width: { md: drawerWidth },
          flexShrink: { md: 0 },
        }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerClose}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
              bgcolor: colors.background.header,
            },
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              p: 1,
              borderBottom: `1px solid ${colors.border.light}`,
            }}
          >
            <IconButton
              onClick={() => setMobileOpen(false)}
              sx={{ color: colors.text.secondary }}
            >
              <CloseIcon />
            </IconButton>
          </Box>

          {drawerContent}
        </Drawer>

        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
              bgcolor: colors.background.header,
            },
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            top: 0,
            zIndex: 1100,
            bgcolor: colors.background.header,
            borderBottom: `1px solid ${colors.border.light}`,
            backdropFilter: "blur(18px)",
          }}
        >
          <Toolbar
            sx={{
              minHeight: { xs: 70, md: 78 },
              px: { xs: 2, md: 3 },
              gap: 2,
              justifyContent: "space-between",
            }}
          >
            <Stack direction="row" spacing={1.6} sx={{ alignItems: "center" }}>
              <IconButton
                onClick={() => setMobileOpen(true)}
                sx={{
                  display: { xs: "inline-flex", md: "none" },
                  color: colors.text.primary,
                  border: `1px solid ${colors.border.light}`,
                  borderRadius: colors.radius.sm,
                }}
              >
                <MenuIcon />
              </IconButton>

              <Box
                sx={{
                  width: 42,
                  height: 42,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: colors.radius.md,
                  color: activeMenuItem?.accent.main || colors.primary.main,
                  bgcolor: activeMenuItem?.accent.soft || colors.primary.soft,
                  border: `1px solid ${
                    activeMenuItem?.accent.border || colors.primary.border
                  }`,
                  "& svg": { fontSize: 25 },
                }}
              >
                {activeMenuItem?.icon || <HomeIcon />}
              </Box>

              <Box>
                <Typography
                  variant="h6"
                  sx={{
                    color: colors.text.primary,
                    fontWeight: 950,
                    lineHeight: 1.15,
                  }}
                >
                  {activeSection}
                </Typography>

                <Typography
                  variant="caption"
                  sx={{ color: colors.text.muted, fontWeight: 650 }}
                >
                  {activeMenuItem?.helper || "Módulo activo"}
                </Typography>
              </Box>
            </Stack>

            <Stack
              direction="row"
              spacing={1.2}
              sx={{ alignItems: "center", minWidth: 0 }}
            >
              {user ? (
                <Box
                  sx={{
                    display: { xs: "none", sm: "block" },
                    textAlign: "right",
                    minWidth: 0,
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{
                      color: colors.text.primary,
                      fontWeight: 900,
                      lineHeight: 1.2,
                    }}
                  >
                    {getUserDisplayName(user)}
                  </Typography>

                  <Typography
                    variant="caption"
                    sx={{ color: colors.text.muted }}
                  >
                    {user.role_display || user.role || "Sin rol"}
                  </Typography>
                </Box>
              ) : null}

              <Chip
                label="Backend protegido"
                size="small"
                variant="outlined"
                sx={{
                  display: { xs: "none", lg: "inline-flex" },
                  color: colors.status.success,
                  bgcolor: colors.status.successSoft,
                  borderColor: colors.status.success,
                  fontWeight: 850,
                }}
              />
            </Stack>
          </Toolbar>
        </AppBar>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            width: "100%",
            minWidth: 0,
            px: { xs: 2, md: 3, xl: 4 },
            py: { xs: 2.4, md: 3 },
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
