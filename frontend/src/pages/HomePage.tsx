import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  Divider,
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
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import HistoryIcon from "@mui/icons-material/History";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { AuthUser } from "../types/auth";
import { fetchDashboardStatistics } from "../services/coreService";
import type { DashboardStatistics } from "../services/coreService";
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

const primaryModules: ModuleCard[] = [
  { label: "Entidades comerciales", description: "Mineras, áreas, subáreas y contactos del flujo comercial.", section: "Entidades comerciales", color: colors.modules.commercial, icon: <BusinessIcon />, badge: "Relaciones" },
  { label: "Inventario", description: "Catálogo, stock, ubicaciones y recepciones físicas.", section: "Inventario", color: colors.modules.inventory, icon: <Inventory2Icon />, badge: "Stock" },
  { label: "Ventas", description: "Ingresos, documentos comerciales y descuento de existencias.", section: "Ventas / Ingresos", color: colors.modules.sales, icon: <PointOfSaleIcon />, badge: "Comercial" },
  { label: "Compras", description: "Órdenes, proveedores, envíos y recepción de productos.", section: "Compras / Egresos", color: colors.modules.purchases, icon: <ShoppingCartIcon />, badge: "Abastecimiento" },
  { label: "Kardex", description: "Historial único y trazable de movimientos de inventario.", section: "Kardex", color: colors.modules.inventory, icon: <HistoryIcon /> },
  { label: "Importaciones Excel", description: "Importa productos desde Excel con prevalidación y revisión por fila.", section: "Importaciones Excel", color: colors.modules.excel, icon: <TableChartIcon />, badge: "Productos" },
  { label: "Estadísticas", description: "Indicadores reales, tendencias comerciales y alertas operativas.", section: "Estadísticas", color: colors.modules.analytics, icon: <BarChartIcon /> },
];

const managementModules: ModuleCard[] = [
  { label: "Usuarios", description: "Cuentas con acceso y permisos dentro de la plataforma.", section: "Usuarios", color: colors.modules.audit, icon: <PeopleAltIcon /> },
  { label: "Colaboradores", description: "Personal interno o temporal, con o sin acceso al sistema.", section: "Colaboradores", color: colors.modules.collaborators, icon: <GroupsIcon /> },
  { label: "Documentos", description: "Facturas, guías, HES, contratos y versiones asociadas.", section: "Documentos", color: colors.modules.documents, icon: <FolderIcon /> },
  { label: "Auditoría", description: "Trazabilidad detallada de acciones y cambios sensibles.", section: "Auditoría", color: colors.modules.audit, icon: <AdminPanelSettingsIcon /> },
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

function formatCLP(value: string | number) {
  const numericValue = Number(value || 0);

  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(numericValue);
}

function buildQuickStats(stats: DashboardStatistics | null): QuickStat[] {
  return [
    {
      label: "Ventas del mes",
      value: formatCLP(stats?.sales.current_month.total || 0),
      helper: `${stats?.sales.current_month.count || 0} ventas registradas este mes`,
      severity: "success",
    },
    {
      label: "Productos activos",
      value: String(stats?.inventory.products_active || 0),
      helper: `${stats?.inventory.products_control_stock || 0} controlan stock`,
      severity: "normal",
    },
    {
      label: "Stock crítico",
      value: String(stats?.inventory.critical_products_count || 0),
      helper: "Productos bajo umbral mínimo",
      severity:
        (stats?.inventory.critical_products_count || 0) > 0
          ? "danger"
          : "success",
    },
    {
      label: "Importaciones con revisión",
      value: String(
        (stats?.imports.rows_requires_review || 0) +
          (stats?.imports.rows_with_error || 0),
      ),
      helper: "Filas con advertencias o errores",
      severity:
        (stats?.imports.rows_requires_review || 0) +
          (stats?.imports.rows_with_error || 0) >
        0
          ? "warning"
          : "success",
    },
  ];
}

function buildHomeAlerts(stats: DashboardStatistics | null): HomeAlert[] {
  if (!stats) {
    return [];
  }

  const output: HomeAlert[] = [];

  if (stats.inventory.critical_products_count > 0) {
    output.push({
      title: "Stock crítico",
      description: `${stats.inventory.critical_products_count} productos están bajo el umbral mínimo definido.`,
      module: "Inventario",
      severity: "error",
      actionSection: "Productos",
    });
  }

  if (stats.sales.active_alerts_count > 0) {
    output.push({
      title: "Alertas comerciales activas",
      description: `${stats.sales.active_alerts_count} alertas de ventas requieren revisión.`,
      module: "Ventas",
      severity: "warning",
      actionSection: "Ventas / Ingresos",
    });
  }

  const importsToReview =
    stats.imports.rows_requires_review + stats.imports.rows_with_error;

  if (importsToReview > 0) {
    output.push({
      title: "Importaciones requieren revisión",
      description: `${importsToReview} filas importadas tienen advertencias o errores.`,
      module: "Importaciones Excel",
      severity: "info",
      actionSection: "Importaciones Excel",
    });
  }

  return output;
}

export function HomePage({ user, onSectionChange }: HomePageProps) {
  const [stats, setStats] = useState<DashboardStatistics | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState("");

  useEffect(() => {
    let isMounted = true;

    fetchDashboardStatistics()
      .then((data) => {
        if (!isMounted) return;

        setStats(data);
        setStatsError("");
      })
      .catch(() => {
        if (!isMounted) return;

        setStatsError(
          "No se pudieron cargar las estadísticas reales de inicio.",
        );
      })
      .finally(() => {
        if (!isMounted) return;

        setLoadingStats(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const quickStats = buildQuickStats(stats);
  const alerts = buildHomeAlerts(stats);
  const urgentAlertsCount = alerts.length;
  const managementRoles = ["ADMINISTRADOR", "RRHH", "FINANZAS_COMERCIAL", "INFORMATICO"];
  const visibleManagementModules = managementRoles.includes(user?.role || "")
    ? managementModules.filter((module) =>
        module.section !== "Auditoría" || ["ADMINISTRADOR", "INFORMATICO"].includes(user?.role || ""),
      )
    : [];

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
                {loadingStats
                  ? "Cargando indicadores reales de la plataforma..."
                  : `Tienes ${urgentAlertsCount} alertas operativas activas, ${
                      stats?.documents.documents_total || 0
                    } documentos registrados y ${
                      stats?.inventory.critical_products_count || 0
                    } productos bajo stock crítico.`}
              </Typography>
            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                onClick={() => onSectionChange("Inventario")}
              >
                Abrir operación
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

      {statsError ? (
        <Alert severity="warning" variant="outlined" sx={{ mb: 3 }}>
          {statsError}
        </Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" },
          gap: 3,
        }}
      >
        <Stack spacing={3}>
          <Box sx={{ order: 2 }}>
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
                  lg: "repeat(3, minmax(0, 1fr))",
                  xl: "repeat(4, minmax(0, 1fr))",
                },
                gap: 2,
              }}
            >
              {primaryModules.map((module) => (
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
                            lineHeight: 1.2,
                            overflowWrap: "anywhere",
                          }}
                        >
                          {module.label}
                        </Typography>

                        <Typography
                          variant="body2"
                          sx={{
                            color: colors.text.secondary,
                            lineHeight: 1.55,
                            overflowWrap: "anywhere",
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

          {visibleManagementModules.length ? (
            <Card sx={{ order: 3, p: 2.2, bgcolor: colors.background.paper, border: `1px solid ${colors.border.light}` }}>
              <Typography variant="h6" sx={{ color: colors.text.primary, fontWeight: 900 }}>
                Administración y soporte
              </Typography>
              <Typography variant="body2" sx={{ color: colors.text.muted, mb: 1.8 }}>
                Personas, documentos y trazabilidad fuera del flujo operativo principal.
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                {visibleManagementModules.map((module) => (
                  <Button
                    key={module.label}
                    variant="outlined"
                    startIcon={module.icon}
                    onClick={() => onSectionChange(module.section)}
                    sx={{ color: module.color.main, borderColor: module.color.border, bgcolor: module.color.soft }}
                  >
                    {module.label}
                  </Button>
                ))}
              </Stack>
            </Card>
          ) : null}
          <Box sx={{ order: 1 }}>
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
            {alerts.length === 0 ? (
              <Alert severity="success" variant="outlined">
                No hay alertas urgentes según los datos actuales del backend.
              </Alert>
            ) : null}

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
