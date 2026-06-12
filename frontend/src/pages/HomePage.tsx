import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  Divider,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import BusinessIcon from "@mui/icons-material/Business";
import FolderIcon from "@mui/icons-material/Folder";
import BarChartIcon from "@mui/icons-material/BarChart";
import TableChartIcon from "@mui/icons-material/TableChart";
import GroupsIcon from "@mui/icons-material/Groups";
import DevicesOtherIcon from "@mui/icons-material/DevicesOther";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import type { ReactNode } from "react";
import type { AuthUser } from "../types/auth";
import { colors } from "../theme/colors";

type HomePageProps = {
  user: AuthUser | null;
  onSectionChange: (section: string) => void;
};

type ModuleColor = {
  main: string;
  soft: string;
  border: string;
  shadow: string;
};

type ModuleCard = {
  label: string;
  description: string;
  section: string;
  color: ModuleColor;
  icon: ReactNode;
  badge?: string;
};

type QuickStat = {
  label: string;
  value: string;
  helper: string;
  severity: "normal" | "warning" | "danger" | "success";
};

type HomeAlert = {
  title: string;
  description: string;
  module: string;
  severity: "error" | "warning" | "info" | "success";
  actionSection: string;
};

const modules: ModuleCard[] = [
  {
    label: "Ventas",
    description: "Registro comercial, ingresos, estados y trazabilidad.",
    section: "Ventas / Ingresos",
    color: colors.modules.sales,
    icon: <PointOfSaleIcon />,
    badge: "Comercial",
  },
  {
    label: "Inventario",
    description: "Productos, stock crítico y movimientos Kardex.",
    section: "Productos",
    color: colors.modules.inventory,
    icon: <Inventory2Icon />,
    badge: "Stock",
  },
  {
    label: "Entidades comerciales",
    description: "Holdings, mineras, áreas, subáreas y contactos.",
    section: "Entidades comerciales",
    color: colors.modules.commercial,
    icon: <BusinessIcon />,
  },
  {
    label: "Documentos",
    description: "Facturas, guías, HES, archivos y versiones.",
    section: "Documentos",
    color: colors.modules.documents,
    icon: <FolderIcon />,
    badge: "Pendientes",
  },
  {
    label: "Estadísticas",
    description: "KPIs, gráficos e inteligencia comercial.",
    section: "Estadísticas",
    color: colors.modules.analytics,
    icon: <BarChartIcon />,
  },
  {
    label: "Importaciones Excel",
    description: "Carga inteligente, prevalidación y errores por fila.",
    section: "Importaciones Excel",
    color: colors.modules.excel,
    icon: <TableChartIcon />,
  },
  {
    label: "Colaboradores",
    description: "Personas internas, perfiles y trazabilidad.",
    section: "Colaboradores",
    color: colors.modules.collaborators,
    icon: <GroupsIcon />,
  },
  {
    label: "Activos y chips",
    description: "Equipos, líneas, asignaciones y responsables.",
    section: "Activos y chips",
    color: colors.modules.assets,
    icon: <DevicesOtherIcon />,
  },
  {
    label: "Compras",
    description: "Abastecimiento, costos, recepción y proveedores.",
    section: "Compras / Egresos",
    color: colors.modules.purchases,
    icon: <ShoppingCartIcon />,
  },
  {
    label: "Auditoría",
    description: "Historial, cambios, anulaciones y operaciones críticas.",
    section: "Auditoría",
    color: colors.modules.audit,
    icon: <AdminPanelSettingsIcon />,
  },
];

const quickStats: QuickStat[] = [
  {
    label: "Ventas del mes",
    value: "$18.450.000",
    helper: "+12% vs mes anterior",
    severity: "success",
  },
  {
    label: "Documentos pendientes",
    value: "7",
    helper: "Facturas, guías o HES por revisar",
    severity: "warning",
  },
  {
    label: "Stock crítico",
    value: "5",
    helper: "Productos bajo umbral mínimo",
    severity: "danger",
  },
  {
    label: "Importaciones con revisión",
    value: "2",
    helper: "Filas con advertencias o duplicados",
    severity: "normal",
  },
];

const alerts: HomeAlert[] = [
  {
    title: "Falta factura",
    description: "Venta ingresada sin documento tributario asociado.",
    module: "Documentos",
    severity: "warning",
    actionSection: "Documentos",
  },
  {
    title: "Stock crítico",
    description: "Producto industrial bajo el umbral mínimo definido.",
    module: "Inventario",
    severity: "error",
    actionSection: "Productos",
  },
  {
    title: "Importación requiere revisión",
    description: "Archivo Excel contiene posibles duplicados.",
    module: "Importaciones Excel",
    severity: "info",
    actionSection: "Importaciones Excel",
  },
];

function getFirstName(user: AuthUser | null) {
  return user?.first_name || user?.username || "usuario";
}

function getStatColor(severity: QuickStat["severity"]) {
  if (severity === "success") return colors.status.success;
  if (severity === "warning") return colors.status.warning;
  if (severity === "danger") return colors.status.error;
  return colors.primary.main;
}

export function HomePage({ user, onSectionChange }: HomePageProps) {
  return (
    <Box sx={{ width: "100%" }}>
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          border: `1px solid ${colors.border.light}`,
          borderRadius: colors.radius.xl,
          p: { xs: 3, md: 4 },
          mb: 3,
          background: `${colors.gradients.heroAccent}, ${colors.gradients.hero}`,
          boxShadow: colors.shadow.elevated,
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            opacity: 1,
            backgroundImage: colors.gradients.subtlePattern,
            backgroundSize: "44px 44px",
            pointerEvents: "none",
          }}
        />

        <Box sx={{ position: "relative", zIndex: 1 }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={3}
            sx={{
              alignItems: { xs: "flex-start", md: "center" },
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Chip
                label="Inicio operativo"
                size="small"
                sx={{
                  mb: 2,
                  color: colors.primary.main,
                  borderColor: colors.primary.border,
                  bgcolor: colors.primary.soft,
                }}
                variant="outlined"
              />

              <Typography
                variant="h3"
                sx={{
                  fontWeight: 900,
                  letterSpacing: "-0.04em",
                  color: colors.text.primary,
                  mb: 1,
                }}
              >
                Hola, {getFirstName(user)}
              </Typography>

              <Typography
                variant="h6"
                sx={{
                  maxWidth: 760,
                  color: colors.text.secondary,
                  fontWeight: 500,
                  lineHeight: 1.5,
                }}
              >
                Tienes 3 alertas activas, 7 documentos pendientes y 5 productos
                bajo stock crítico.
              </Typography>
            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                onClick={() => onSectionChange("Documentos")}
              >
                Revisar pendientes
              </Button>

              <Button
                variant="outlined"
                onClick={() => onSectionChange("Estadísticas")}
                sx={{
                  color: colors.text.primary,
                  borderColor: colors.border.medium,
                  "&:hover": {
                    borderColor: colors.primary.border,
                    bgcolor: colors.action.hover,
                  },
                }}
              >
                Ver estadísticas
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" },
          gap: 3,
        }}
      >
        <Stack spacing={3}>
          <Box>
            <Typography
              variant="h5"
              sx={{ color: colors.text.primary, fontWeight: 900, mb: 2 }}
            >
              Accesos principales
            </Typography>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                  xl: "repeat(5, minmax(0, 1fr))",
                },
                gap: 2,
              }}
            >
              {modules.map((module) => (
                <Card
                  key={module.label}
                  sx={{
                    height: "100%",
                    bgcolor: colors.background.paper,
                    border: `1px solid ${colors.border.light}`,
                    transition:
                      "transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease",
                    "&:hover": {
                      transform: "translateY(-3px)",
                      borderColor: module.color.border,
                      boxShadow: module.color.shadow,
                      bgcolor: colors.surface.soft,
                    },
                  }}
                >
                  <CardActionArea
                    onClick={() => onSectionChange(module.section)}
                    sx={{ height: "100%", p: 2.2 }}
                  >
                    <Stack spacing={2}>
                      <Stack
                        direction="row"
                        sx={{
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Box
                          sx={{
                            width: 46,
                            height: 46,
                            display: "grid",
                            placeItems: "center",
                            borderRadius: colors.radius.md,
                            color: module.color.main,
                            bgcolor: module.color.soft,
                            border: `1px solid ${module.color.border}`,
                            "& svg": { fontSize: 27 },
                          }}
                        >
                          {module.icon}
                        </Box>

                        {module.badge ? (
                          <Chip
                            label={module.badge}
                            size="small"
                            sx={{
                              color: module.color.main,
                              bgcolor: module.color.soft,
                              borderColor: module.color.border,
                            }}
                            variant="outlined"
                          />
                        ) : null}
                      </Stack>

                      <Box>
                        <Typography
                          variant="h6"
                          sx={{
                            color: colors.text.primary,
                            fontWeight: 900,
                            mb: 0.7,
                          }}
                        >
                          {module.label}
                        </Typography>

                        <Typography
                          variant="body2"
                          sx={{
                            color: colors.text.secondary,
                            lineHeight: 1.55,
                          }}
                        >
                          {module.description}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardActionArea>
                </Card>
              ))}
            </Box>
          </Box>

          <Box>
            <Typography
              variant="h5"
              sx={{ color: colors.text.primary, fontWeight: 900, mb: 2 }}
            >
              Vista rápida
            </Typography>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                  xl: "repeat(4, minmax(0, 1fr))",
                },
                gap: 2,
              }}
            >
              {quickStats.map((stat) => {
                const statColor = getStatColor(stat.severity);

                return (
                  <Card
                    key={stat.label}
                    sx={{
                      height: "100%",
                      p: 2.2,
                      bgcolor: colors.background.paper,
                      border: `1px solid ${colors.border.light}`,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ color: colors.text.secondary, mb: 1 }}
                    >
                      {stat.label}
                    </Typography>

                    <Typography
                      variant="h4"
                      sx={{
                        color: colors.text.primary,
                        fontWeight: 900,
                        mb: 1,
                      }}
                    >
                      {stat.value}
                    </Typography>

                    <Typography
                      variant="caption"
                      sx={{ color: statColor, fontWeight: 800 }}
                    >
                      {stat.helper}
                    </Typography>

                    <LinearProgress
                      variant="determinate"
                      value={72}
                      sx={{
                        mt: 2,
                        height: 6,
                        borderRadius: colors.radius.xs,
                        bgcolor: colors.surface.muted,
                        "& .MuiLinearProgress-bar": {
                          bgcolor: statColor,
                          borderRadius: colors.radius.xs,
                        },
                      }}
                    />
                  </Card>
                );
              })}
            </Box>
          </Box>
        </Stack>

        <Card
          sx={{
            p: 2.4,
            bgcolor: colors.background.paper,
            border: `1px solid ${colors.border.light}`,
            position: { lg: "sticky" },
            top: { lg: 24 },
            alignSelf: "start",
          }}
        >
          <Stack
            direction="row"
            spacing={1.5}
            sx={{
              alignItems: "center",
              mb: 2,
            }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                display: "grid",
                placeItems: "center",
                borderRadius: colors.radius.md,
                color: colors.status.warning,
                bgcolor: colors.status.warningSoft,
                border: `1px solid ${colors.secondary.border}`,
              }}
            >
              <WarningAmberIcon />
            </Box>

            <Box>
              <Typography
                variant="h5"
                sx={{ color: colors.text.primary, fontWeight: 900 }}
              >
                Alertas urgentes
              </Typography>

              <Typography variant="body2" sx={{ color: colors.text.muted }}>
                Tareas que requieren revisión operativa.
              </Typography>
            </Box>
          </Stack>

          <Divider sx={{ borderColor: colors.border.light, mb: 2 }} />

          <Stack spacing={1.5}>
            {alerts.map((alert) => (
              <Alert
                key={alert.title}
                severity={alert.severity}
                variant="outlined"
                action={
                  <Button
                    size="small"
                    onClick={() => onSectionChange(alert.actionSection)}
                  >
                    Abrir
                  </Button>
                }
                sx={{
                  alignItems: "flex-start",
                  bgcolor: colors.surface.base,
                  borderRadius: colors.radius.md,
                  "& .MuiAlert-message": { width: "100%" },
                }}
              >
                <Typography sx={{ fontWeight: 900 }}>{alert.title}</Typography>

                <Typography variant="body2">{alert.description}</Typography>

                <Chip
                  label={alert.module}
                  size="small"
                  sx={{ mt: 1 }}
                  variant="outlined"
                />
              </Alert>
            ))}
          </Stack>
        </Card>
      </Box>
    </Box>
  );
}
