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
  Stack,
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

const drawerWidth = 280;

type AppLayoutProps = {
  user: AuthUser | null;
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
      "SUPERVISOR",
      "TRABAJADOR",
      "SOLO_LECTURA",
    ],
  },
  {
    label: "Usuarios",
    icon: <PeopleIcon />,
    roles: ["ADMINISTRADOR", "RRHH"],
  },
  {
    label: "Clientes",
    icon: <BusinessIcon />,
    roles: ["ADMINISTRADOR", "FINANZAS_COMERCIAL", "RRHH", "SUPERVISOR"],
  },
  {
    label: "Productos",
    icon: <InventoryIcon />,
    roles: ["ADMINISTRADOR", "FINANZAS_COMERCIAL", "RRHH", "SUPERVISOR"],
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
      "SUPERVISOR",
      "TRABAJADOR",
    ],
  },
];

export function AppLayout({ user, onLogout, children }: AppLayoutProps) {
  const role = user?.profile?.role;

  const visibleMenuItems = menuItems.filter((item) =>
    role ? item.roles.includes(role) : false
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            bgcolor: colors.sidebar,
            color: colors.sidebarText,
            borderRight: "none",
          },
        }}
      >
        <Box sx={{ p: 3 }}>
          <Typography variant="h5" fontWeight={800}>
            Serkan V2
          </Typography>

          <Typography variant="body2" sx={{ color: colors.textMuted, mt: 0.5 }}>
            Plataforma interna
          </Typography>
        </Box>

        <Divider sx={{ borderColor: "rgba(255,255,255,0.12)" }} />

        <List sx={{ px: 1.5, py: 2 }}>
          {visibleMenuItems.map((item) => (
            <ListItemButton
              key={item.label}
              selected={item.label === "Dashboard"}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                color: colors.sidebarText,
                "&.Mui-selected": {
                  bgcolor: colors.sidebarActive,
                  color: "#FFFFFF",
                },
                "&.Mui-selected:hover": {
                  bgcolor: colors.sidebarActive,
                },
                "&:hover": {
                  bgcolor: "rgba(255,255,255,0.08)",
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
            borderBottom: `1px solid ${colors.border}`,
            bgcolor: colors.surface,
          }}
        >
          <Toolbar sx={{ justifyContent: "space-between" }}>
            <Box>
              <Typography variant="h6">Dashboard</Typography>
              <Typography variant="body2" color="text.secondary">
                Resumen general de la plataforma
              </Typography>
            </Box>

            <Stack direction="row" spacing={2} alignItems="center">
              {user && (
                <Box sx={{ textAlign: "right" }}>
                  <Typography variant="body2" fontWeight={700}>
                    {user.username}
                  </Typography>
                  <Chip
                    size="small"
                    label={user.profile?.role_display || "Sin rol"}
                    color="primary"
                    variant="outlined"
                  />
                </Box>
              )}

              <Button
                variant="outlined"
                color="error"
                startIcon={<LogoutIcon />}
                onClick={onLogout}
              >
                Salir
              </Button>
            </Stack>
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ py: 4 }}>
          {children}
        </Container>
      </Box>
    </Box>
  );
}