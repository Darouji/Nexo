import { useMemo, useState } from "react";
import type { ReactNode, SyntheticEvent } from "react";
import {
  AppBar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import AssessmentIcon from "@mui/icons-material/Assessment";
import BusinessIcon from "@mui/icons-material/Business";
import CloseIcon from "@mui/icons-material/Close";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import DescriptionIcon from "@mui/icons-material/Description";
import GroupsIcon from "@mui/icons-material/Groups";
import HomeIcon from "@mui/icons-material/Home";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import LightModeIcon from "@mui/icons-material/LightMode";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import SecurityIcon from "@mui/icons-material/Security";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import type { AuthUser } from "../types/auth";
import { getStoredAccess } from "../services/authService";
import {
  getStoredLayoutMode,
  setStoredLayoutMode,
  type AppLayoutMode,
} from "../services/layoutPreference";
import {
  applyThemeMode,
  getStoredThemeMode,
} from "../services/themePreference";
import { colors } from "../theme/colors";

const drawerWidth = 294;

type MenuItem = {
  label: string;
  moduleKey: string;
  fallbackRoles: string[];
  icon: ReactNode;
  helper: string;
  demo?: boolean;
  accent: {
    main: string;
    soft: string;
    border: string;
  };
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
    icon: <HomeIcon />,
    helper: "Panel general",
    accent: colors.primary,
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
    icon: <PeopleAltIcon />,
    helper: "Cuentas internas",
    accent: colors.modules.audit,
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
    icon: <GroupsIcon />,
    helper: "Personas SERKAN",
    accent: colors.modules.collaborators,
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
    icon: <BusinessIcon />,
    helper: "Holding, minera y contactos",
    accent: colors.modules.commercial,
  },
  {
    label: "Inventario",
    moduleKey: "inventario",
    fallbackRoles: [
      "ADMINISTRADOR",
      "FINANZAS_COMERCIAL",
      "RRHH",
      "INFORMATICO",
      "OPERATIVO",
      "CONSULTA",
    ],
    icon: <Inventory2Icon />,
    helper: "Inventario y Kardex",
    accent: colors.modules.inventory,
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
    icon: <PointOfSaleIcon />,
    helper: "Ventas y alertas",
    accent: colors.modules.sales,
  },
  {
    label: "Compras / Egresos",
    moduleKey: "compras_demo",
    fallbackRoles: ["ADMINISTRADOR", "FINANZAS_COMERCIAL"],
    icon: <ShoppingCartIcon />,
    helper: "Vista demo de compras",
    demo: true,
    accent: colors.modules.purchases,
  },
  {
    label: "Importaciones Excel",
    moduleKey: "importaciones",
    fallbackRoles: ["ADMINISTRADOR", "FINANZAS_COMERCIAL", "INFORMATICO"],
    icon: <UploadFileIcon />,
    helper: "Carga masiva",
    accent: colors.modules.excel,
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
    icon: <DescriptionIcon />,
    helper: "Archivos y versiones",
    accent: colors.modules.documents,
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
    icon: <AssessmentIcon />,
    helper: "Indicadores",
    accent: colors.modules.analytics,
  },
  {
    label: "Auditoría",
    moduleKey: "auditoria",
    fallbackRoles: ["ADMINISTRADOR", "INFORMATICO"],
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

type LayoutViewProps = AppLayoutProps & {
  visibleMenuItems: MenuItem[];
  activeMenuItem: MenuItem;
  layoutMode: AppLayoutMode;
  onOpenLayoutChooser: () => void;
};

function getUserDisplayName(user: AuthUser | null) {
  if (!user) {
    return "Usuario";
  }

  const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();

  return fullName || user.full_name || user.username;
}

function ThemeModeButton() {
  const currentMode = getStoredThemeMode(colors.mode);
  const nextMode = currentMode === "dark" ? "light" : "dark";
  const title =
    nextMode === "dark" ? "Cambiar a modo oscuro" : "Cambiar a modo claro";

  return (
    <Tooltip title={title}>
      <IconButton
        onClick={() => applyThemeMode(nextMode)}
        sx={{
          color: colors.text.primary,
          border: `1px solid ${colors.border.light}`,
          borderRadius: colors.radius.sm,
          bgcolor: colors.background.paper,
          "&:hover": {
            bgcolor: colors.action.hover,
          },
        }}
      >
        {currentMode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>
    </Tooltip>
  );
}

function LayoutModeButton({
  layoutMode,
  onOpenLayoutChooser,
}: {
  layoutMode: AppLayoutMode;
  onOpenLayoutChooser: () => void;
}) {
  return (
    <Button
      variant="outlined"
      size="small"
      onClick={onOpenLayoutChooser}
      sx={{
        display: { xs: "none", sm: "inline-flex" },
        color: colors.text.primary,
        borderColor: colors.border.light,
        bgcolor: colors.background.paper,
        fontWeight: 850,
        "&:hover": {
          borderColor: colors.primary.border,
          bgcolor: colors.action.hover,
        },
      }}
    >
      Vista: {layoutMode === "vertical" ? "Lateral" : "Superior"}
    </Button>
  );
}

function LayoutChooserDialog({
  open,
  layoutMode,
  onSelect,
  onClose,
}: {
  open: boolean;
  layoutMode: AppLayoutMode;
  onSelect: (mode: AppLayoutMode) => void;
  onClose: () => void;
}) {
  const options = [
    {
      mode: "horizontal" as const,
      title: "Vista superior",
      description:
        "Menú horizontal por pestañas. Útil para demostración rápida y pantallas anchas.",
      icon: <HomeIcon />,
    },
    {
      mode: "vertical" as const,
      title: "Vista lateral",
      description:
        "Menú vertical con barra lateral. Útil para operación diaria y módulos numerosos.",
      icon: <MenuIcon />,
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle
        sx={{
          color: colors.text.primary,
          fontWeight: 950,
          letterSpacing: "-0.03em",
          pb: 1,
        }}
      >
        Elige tu vista de trabajo
      </DialogTitle>

      <DialogContent>
        <Typography sx={{ color: colors.text.secondary, mb: 2.5 }}>
          Puedes cambiar esta preferencia después desde el botón de vista en la
          barra superior.
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
            gap: 2,
          }}
        >
          {options.map((option) => {
            const selected = option.mode === layoutMode;

            return (
              <Card
                key={option.mode}
                sx={{
                  height: "100%",
                  bgcolor: selected
                    ? colors.primary.soft
                    : colors.background.paper,
                  border: `1px solid ${
                    selected ? colors.primary.border : colors.border.light
                  }`,
                  boxShadow: colors.shadow.card,
                }}
              >
                <CardActionArea
                  onClick={() => onSelect(option.mode)}
                  sx={{ height: "100%" }}
                >
                  <CardContent>
                    <Stack spacing={1.7}>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          display: "grid",
                          placeItems: "center",
                          borderRadius: colors.radius.md,
                          color: selected
                            ? colors.primary.main
                            : colors.text.muted,
                          bgcolor: colors.background.paper,
                          border: `1px solid ${
                            selected
                              ? colors.primary.border
                              : colors.border.light
                          }`,
                          "& svg": { fontSize: 28 },
                        }}
                      >
                        {option.icon}
                      </Box>

                      <Box>
                        <Typography
                          variant="h6"
                          sx={{
                            color: colors.text.primary,
                            fontWeight: 950,
                          }}
                        >
                          {option.title}
                        </Typography>

                        <Typography
                          variant="body2"
                          sx={{
                            color: colors.text.secondary,
                            lineHeight: 1.55,
                          }}
                        >
                          {option.description}
                        </Typography>
                      </Box>

                      <Chip
                        size="small"
                        label={selected ? "Vista actual" : "Seleccionar"}
                        variant="outlined"
                        sx={{
                          alignSelf: "flex-start",
                          color: selected
                            ? colors.primary.main
                            : colors.text.muted,
                          borderColor: selected
                            ? colors.primary.border
                            : colors.border.light,
                          bgcolor: selected
                            ? colors.primary.soft
                            : "transparent",
                        }}
                      />
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            );
          })}
        </Box>
      </DialogContent>
    </Dialog>
  );
}

function SidebarContent({
  user,
  activeSection,
  visibleMenuItems,
  onSectionChange,
  onLogout,
  onClose,
  layoutMode,
  onOpenLayoutChooser,
}: {
  user: AuthUser | null;
  activeSection: string;
  visibleMenuItems: MenuItem[];
  onSectionChange: (section: string) => void;
  onLogout: () => void;
  onClose?: () => void;
  layoutMode: AppLayoutMode;
  onOpenLayoutChooser: () => void;
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
                    <Stack
                      direction="row"
                      spacing={0.7}
                      sx={{ alignItems: "center" }}
                    >
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

                      {item.demo ? (
                        <Chip
                          label="Demo"
                          size="small"
                          variant="outlined"
                          sx={{
                            height: 20,
                            color: colors.status.info,
                            borderColor: colors.status.info,
                            bgcolor: colors.status.infoSoft,
                            fontSize: "0.66rem",
                          }}
                        />
                      ) : null}
                    </Stack>

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

        <Stack direction="row" spacing={1} sx={{ mb: 1.2 }}>
          <Button
            fullWidth
            variant="outlined"
            size="small"
            onClick={onOpenLayoutChooser}
            sx={{
              color: colors.text.primary,
              borderColor: colors.border.light,
              fontWeight: 850,
            }}
          >
            {layoutMode === "vertical" ? "Lateral" : "Superior"}
          </Button>

          <ThemeModeButton />
        </Stack>

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

function HorizontalLayout({
  user,
  activeSection,
  onSectionChange,
  onLogout,
  children,
  visibleMenuItems,
  layoutMode,
  onOpenLayoutChooser,
}: LayoutViewProps) {
  const currentTabIndex = visibleMenuItems.findIndex(
    (item) => item.label === activeSection,
  );

  const handleTabChange = (_event: SyntheticEvent, newValue: number) => {
    if (newValue >= 0 && newValue < visibleMenuItems.length) {
      onSectionChange(visibleMenuItems[newValue].label);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: colors.background.main,
        display: "flex",
        flexDirection: "column",
      }}
    >
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
        <Toolbar sx={{ justifyContent: "space-between", py: 1, px: 3, gap: 2 }}>
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
                  letterSpacing: "0.09em",
                }}
              >
                V2 // CONTROL OPERATIVO
              </Typography>
            </Box>
          </Box>

          <Stack
            direction="row"
            spacing={1.2}
            sx={{ alignItems: "center", minWidth: 0 }}
          >
            {user ? (
              <Box
                sx={{
                  display: { xs: "none", md: "block" },
                  textAlign: "right",
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 700, color: colors.text.primary }}
                >
                  {getUserDisplayName(user)}
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
            ) : null}

            <LayoutModeButton
              layoutMode={layoutMode}
              onOpenLayoutChooser={onOpenLayoutChooser}
            />

            <ThemeModeButton />

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
          </Stack>
        </Toolbar>

        <Box sx={{ px: 2, bgcolor: colors.background.main }}>
          <Tabs
            value={currentTabIndex >= 0 ? currentTabIndex : false}
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
              <Tab
                key={item.label}
                label={
                  item.demo ? (
                    <Stack
                      direction="row"
                      spacing={0.7}
                      sx={{ alignItems: "center" }}
                    >
                      <span>{item.label}</span>
                      <Chip
                        label="Demo"
                        size="small"
                        variant="outlined"
                        sx={{
                          height: 20,
                          color: colors.status.info,
                          borderColor: colors.status.info,
                          bgcolor: colors.status.infoSoft,
                          fontSize: "0.66rem",
                        }}
                      />
                    </Stack>
                  ) : (
                    item.label
                  )
                }
              />
            ))}
          </Tabs>
        </Box>
      </AppBar>

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

function VerticalLayout({
  user,
  activeSection,
  onSectionChange,
  onLogout,
  children,
  visibleMenuItems,
  activeMenuItem,
  layoutMode,
  onOpenLayoutChooser,
}: LayoutViewProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const drawerContent = (
    <SidebarContent
      user={user}
      activeSection={activeSection}
      visibleMenuItems={visibleMenuItems}
      onSectionChange={onSectionChange}
      onLogout={onLogout}
      onClose={() => setMobileOpen(false)}
      layoutMode={layoutMode}
      onOpenLayoutChooser={onOpenLayoutChooser}
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
          onClose={() => setMobileOpen(false)}
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
                  color: activeMenuItem.accent.main,
                  bgcolor: activeMenuItem.accent.soft,
                  border: `1px solid ${activeMenuItem.accent.border}`,
                  "& svg": { fontSize: 25 },
                }}
              >
                {activeMenuItem.icon}
              </Box>

              <Box>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center" }}
                >
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

                  {activeMenuItem.demo ? (
                    <Chip
                      label="Demo"
                      size="small"
                      variant="outlined"
                      sx={{
                        color: colors.status.info,
                        borderColor: colors.status.info,
                        bgcolor: colors.status.infoSoft,
                      }}
                    />
                  ) : null}
                </Stack>

                <Typography
                  variant="caption"
                  sx={{ color: colors.text.muted, fontWeight: 650 }}
                >
                  {activeMenuItem.helper || "Módulo activo"}
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

              <LayoutModeButton
                layoutMode={layoutMode}
                onOpenLayoutChooser={onOpenLayoutChooser}
              />

              <ThemeModeButton />

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

export function AppLayout({
  user,
  activeSection,
  onSectionChange,
  onLogout,
  children,
}: AppLayoutProps) {
  const [layoutMode, setLayoutMode] = useState<AppLayoutMode>(
    () => getStoredLayoutMode() ?? "horizontal",
  );
  const [layoutChooserOpen, setLayoutChooserOpen] = useState(
    () => getStoredLayoutMode() === null,
  );

  const role = user?.role;
  const access = getStoredAccess();

  const visibleMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      const permission = access?.permissions?.[item.moduleKey];

      if (permission) {
        return permission.can_view;
      }

      return role ? item.fallbackRoles.includes(role) : false;
    });
  }, [access, role]);

  const activeMenuItem =
    visibleMenuItems.find((item) => item.label === activeSection) ??
    visibleMenuItems[0] ??
    menuItems[0];

  const handleLayoutSelect = (mode: AppLayoutMode) => {
    setStoredLayoutMode(mode);
    setLayoutMode(mode);
    setLayoutChooserOpen(false);
  };

  const sharedProps: LayoutViewProps = {
    user,
    activeSection,
    onSectionChange,
    onLogout,
    children,
    visibleMenuItems,
    activeMenuItem,
    layoutMode,
    onOpenLayoutChooser: () => setLayoutChooserOpen(true),
  };

  return (
    <>
      <LayoutChooserDialog
        open={layoutChooserOpen}
        layoutMode={layoutMode}
        onSelect={handleLayoutSelect}
        onClose={() => setLayoutChooserOpen(false)}
      />

      {layoutMode === "vertical" ? (
        <VerticalLayout {...sharedProps} />
      ) : (
        <HorizontalLayout {...sharedProps} />
      )}
    </>
  );
}
