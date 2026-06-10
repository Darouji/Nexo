import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import BusinessIcon from "@mui/icons-material/Business";
import InventoryIcon from "@mui/icons-material/Inventory";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DescriptionIcon from "@mui/icons-material/Description";
import LogoutIcon from "@mui/icons-material/Logout";
import type { ReactNode } from "react";
import type { AuthUser } from "../types/auth";
import { colors } from "../theme/colors";
import BadgeIcon from "@mui/icons-material/Badge";

const drawerWidth = 280;

type AppLayoutProps = {
  user: AuthUser | null;
  activeSection: string;
  onSectionChange: (section: string) => void;
  onLogout: () => void;
  children: ReactNode;
};

const menuItems = [
  {
    label: "Dashboard",
    icon: <DashboardIcon />,
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
    icon: <PeopleIcon />,
    roles: ["ADMINISTRADOR", "RRHH", "FINANZAS_COMERCIAL", "INFORMATICO"],
  },
  {
    label: "Colaboradores",
    icon: <BadgeIcon />,
    roles: ["ADMINISTRADOR", "RRHH", "FINANZAS_COMERCIAL", "INFORMATICO"],
  },
  {
    label: "Clientes",
    icon: <BusinessIcon />,
    roles: ["ADMINISTRADOR", "FINANZAS_COMERCIAL", "RRHH", "INFORMATICO"],
  },
  {
    label: "Productos",
    icon: <InventoryIcon />,
    roles: ["ADMINISTRADOR", "FINANZAS_COMERCIAL", "RRHH", "INFORMATICO"],
  },
  {
    label: "Ventas / Ingresos",
    icon: <ReceiptLongIcon />,
    roles: ["ADMINISTRADOR", "FINANZAS_COMERCIAL"],
  },
  {
    label: "Compras / Egresos",
    icon: <ShoppingCartIcon />,
    roles: ["ADMINISTRADOR", "FINANZAS_COMERCIAL"],
  },
  {
    label: "Importaciones Excel",
    icon: <UploadFileIcon />,
    roles: ["ADMINISTRADOR", "FINANZAS_COMERCIAL"],
  },
  {
    label: "Documentos",
    icon: <DescriptionIcon />,
    roles: [
      "ADMINISTRADOR",
      "FINANZAS_COMERCIAL",
      "RRHH",
      "INFORMATICO",
      "OPERATIVO",
    ],
  },
];

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

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        bgcolor: "background.default",
      }}
    >
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            bgcolor: colors.background.paper,
            color: colors.text.secondary,
            borderRight: "none",
          },
        }}
      >
        <Box sx={{ p: 3 }}>
          <Typography
            variant="h5"
            sx={{ fontWeight: 800, color: colors.text.primary }}
          >
            Serkan V2
          </Typography>

          <Typography
            variant="body2"
            sx={{ color: colors.text.muted, mt: 0.5 }}
          >
            Plataforma interna
          </Typography>
        </Box>

        <Divider sx={{ borderColor: colors.border.light }} />

        <List sx={{ px: 1.5, py: 2 }}>
          {visibleMenuItems.map((item) => (
            <ListItemButton
              key={item.label}
              selected={item.label === activeSection}
              onClick={() => onSectionChange(item.label)}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                color: colors.text.secondary,
                "&.Mui-selected": {
                  bgcolor: colors.primary.activeTab,
                  color: colors.primary.main,
                },
                "&.Mui-selected:hover": {
                  bgcolor: colors.primary.activeTab,
                },
                "&:hover": {
                  bgcolor: "rgba(255,255,255,0.04)",
                },
              }}
            >
              <ListItemIcon sx={{ color: "inherit", minWidth: 40 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <AppBar
          position="static"
          elevation={0}
          color="inherit"
          sx={{
            borderBottom: `1px solid ${colors.border.light}`,
            bgcolor: colors.background.header,
          }}
        >
          <Toolbar sx={{ justifyContent: "space-between" }}>
            <Box>
              <Typography variant="h6" sx={{ color: colors.text.primary }}>
                {activeSection}
              </Typography>
              <Typography variant="body2" sx={{ color: colors.text.secondary }}>
                Sección actual de la plataforma
              </Typography>
            </Box>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
              }}
            >
              {user && (
                <Box sx={{ textAlign: "right" }}>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 700, color: colors.text.primary }}
                  >
                    {user.username}
                  </Typography>

                  <Chip
                    size="small"
                    label={user.profile?.role_display || "Sin rol"}
                    sx={{
                      color: colors.primary.main,
                      borderColor: colors.primary.main,
                      bgcolor: colors.primary.activeTab,
                    }}
                    variant="outlined"
                  />
                </Box>
              )}

              <Button
                variant="outlined"
                sx={{
                  color: colors.status.error,
                  borderColor: colors.status.error,
                  "&:hover": {
                    bgcolor: "rgba(255, 0, 60, 0.08)",
                    borderColor: colors.status.error,
                  },
                }}
                startIcon={<LogoutIcon />}
                onClick={onLogout}
              >
                Salir
              </Button>
            </Box>
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ py: 4 }}>
          {children}
        </Container>
      </Box>
    </Box>
  );
}
