import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import axios from "axios";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import BarChartIcon from "@mui/icons-material/BarChart";
import BusinessIcon from "@mui/icons-material/Business";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import RefreshIcon from "@mui/icons-material/Refresh";
import TableChartIcon from "@mui/icons-material/TableChart";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { fetchDashboardStatistics } from "../services/coreService";
import type { DashboardStatistics } from "../services/coreService";
import { colors } from "../theme/colors";

type AccentColor = {
  main: string;
  soft: string;
  border: string;
  shadow?: string;
};

type KpiCardProps = {
  title: string;
  value: string;
  helper: string;
  icon: ReactNode;
  accent: AccentColor;
};

type ProgressRowProps = {
  label: string;
  value: number;
  max: number;
  helper: string;
  accent: AccentColor;
};

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { detail?: string; [key: string]: unknown }
      | undefined;

    if (data?.detail) {
      return data.detail;
    }

    if (data && typeof data === "object") {
      return Object.entries(data)
        .map(([field, value]) => {
          if (Array.isArray(value)) {
            return `${field}: ${value.join(", ")}`;
          }

          return `${field}: ${String(value)}`;
        })
        .join(" | ");
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "No se pudieron cargar las estadísticas.";
}

function formatNumber(value: number | string | null | undefined) {
  return new Intl.NumberFormat("es-CL").format(Number(value || 0));
}

function formatCLP(value: number | string | null | undefined) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getPercent(value: number, max: number) {
  if (!max || max <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((value / max) * 100));
}

function KpiCard({ title, value, helper, icon, accent }: KpiCardProps) {
  return (
    <Card
      sx={{
        height: "100%",
        bgcolor: colors.background.paper,
        border: `1px solid ${colors.border.light}`,
        boxShadow: colors.shadow.card,
      }}
    >
      <CardContent>
        <Stack spacing={2}>
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Box
              sx={{
                width: 46,
                height: 46,
                display: "grid",
                placeItems: "center",
                borderRadius: colors.radius.md,
                color: accent.main,
                bgcolor: accent.soft,
                border: `1px solid ${accent.border}`,
                "& svg": { fontSize: 27 },
              }}
            >
              {icon}
            </Box>

            <Chip
              label="Real"
              size="small"
              variant="outlined"
              sx={{
                color: accent.main,
                bgcolor: accent.soft,
                borderColor: accent.border,
                fontWeight: 800,
              }}
            />
          </Stack>

          <Box>
            <Typography
              variant="body2"
              sx={{ color: colors.text.secondary, fontWeight: 700 }}
            >
              {title}
            </Typography>

            <Typography
              variant="h4"
              sx={{
                color: colors.text.primary,
                fontWeight: 950,
                letterSpacing: "-0.04em",
                mt: 0.5,
              }}
            >
              {value}
            </Typography>

            <Typography
              variant="caption"
              sx={{ color: colors.text.muted, display: "block", mt: 0.7 }}
            >
              {helper}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function ProgressRow({ label, value, max, helper, accent }: ProgressRowProps) {
  const percent = getPercent(value, max);

  return (
    <Stack spacing={1}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", gap: 2 }}
      >
        <Box>
          <Typography
            variant="body2"
            sx={{ color: colors.text.primary, fontWeight: 800 }}
          >
            {label}
          </Typography>

          <Typography variant="caption" sx={{ color: colors.text.muted }}>
            {helper}
          </Typography>
        </Box>

        <Typography
          variant="body2"
          sx={{ color: accent.main, fontWeight: 900, whiteSpace: "nowrap" }}
        >
          {formatNumber(value)}
        </Typography>
      </Stack>

      <Box
        sx={{
          height: 11,
          borderRadius: colors.radius.xs,
          bgcolor: colors.surface.muted,
          border: `1px solid ${colors.border.light}`,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            width: `${percent}%`,
            height: "100%",
            bgcolor: accent.main,
            transition: "width 180ms ease",
          }}
        />
      </Box>
    </Stack>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card
      sx={{
        bgcolor: colors.background.paper,
        border: `1px solid ${colors.border.light}`,
        boxShadow: colors.shadow.card,
      }}
    >
      <CardContent>
        <Stack spacing={2.5}>
          <Box>
            <Typography
              variant="h6"
              sx={{ color: colors.text.primary, fontWeight: 900 }}
            >
              {title}
            </Typography>

            <Typography variant="body2" sx={{ color: colors.text.secondary }}>
              {description}
            </Typography>
          </Box>

          <Divider />

          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}

export function StatisticsPage() {
  const [stats, setStats] = useState<DashboardStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    fetchDashboardStatistics()
      .then((data) => {
        if (!isMounted) return;

        setStats(data);
        setErrorMessage("");
      })
      .catch((error: unknown) => {
        if (!isMounted) return;

        setErrorMessage(getErrorMessage(error));
      })
      .finally(() => {
        if (!isMounted) return;

        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setErrorMessage("");

    fetchDashboardStatistics()
      .then((data) => {
        setStats(data);
        setErrorMessage("");
      })
      .catch((error: unknown) => {
        setErrorMessage(getErrorMessage(error));
      })
      .finally(() => {
        setRefreshing(false);
      });
  };

  const analytics = useMemo(() => {
    const productsTotal = stats?.inventory.products_total || 0;
    const productsActive = stats?.inventory.products_active || 0;
    const criticalProducts = stats?.inventory.critical_products_count || 0;
    const stockControlled = stats?.inventory.products_control_stock || 0;

    const importsRows = stats?.imports.rows_total || 0;
    const importsErrors = stats?.imports.rows_with_error || 0;
    const importsReview = stats?.imports.rows_requires_review || 0;

    const salesTotal = stats?.sales.sales_total || 0;
    const salesValid = stats?.sales.sales_valid || 0;
    const salesAlerts = stats?.sales.active_alerts_count || 0;

    const documentsTotal = stats?.documents.documents_total || 0;
    const documentsActive = stats?.documents.documents_active || 0;
    const versionsTotal = stats?.documents.versions_total || 0;

    return {
      productsMax: Math.max(
        productsTotal,
        productsActive,
        stockControlled,
        criticalProducts,
        1,
      ),
      importsMax: Math.max(importsRows, importsErrors, importsReview, 1),
      salesMax: Math.max(salesTotal, salesValid, salesAlerts, 1),
      documentsMax: Math.max(documentsTotal, documentsActive, versionsTotal, 1),
      commercialTotal:
        (stats?.general.holdings_active || 0) +
        (stats?.general.mineras_active || 0) +
        (stats?.general.contacts_active || 0),
      importsPending: importsErrors + importsReview,
    };
  }, [stats]);

  if (loading) {
    return (
      <Stack spacing={2} sx={{ alignItems: "center", py: 6 }}>
        <CircularProgress />
        <Typography sx={{ color: colors.text.secondary }}>
          Cargando estadísticas reales de SERKAN...
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          border: `1px solid ${colors.border.light}`,
          borderRadius: colors.radius.xl,
          p: { xs: 3, md: 4 },
          background: `${colors.gradients.heroAccent}, ${colors.gradients.hero}`,
          boxShadow: colors.shadow.elevated,
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backgroundImage: colors.gradients.subtlePattern,
            backgroundSize: "44px 44px",
            pointerEvents: "none",
          }}
        />

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={3}
          sx={{
            position: "relative",
            zIndex: 1,
            alignItems: { xs: "flex-start", md: "center" },
            justifyContent: "space-between",
          }}
        >
          <Box>
            <Chip
              label="Inteligencia operacional"
              size="small"
              variant="outlined"
              icon={<BarChartIcon />}
              sx={{
                mb: 2,
                color: colors.modules.analytics.main,
                bgcolor: colors.modules.analytics.soft,
                borderColor: colors.modules.analytics.border,
                fontWeight: 800,
              }}
            />

            <Typography
              variant="h3"
              sx={{
                color: colors.text.primary,
                fontWeight: 950,
                letterSpacing: "-0.05em",
                mb: 1,
              }}
            >
              Estadísticas
            </Typography>

            <Typography
              variant="h6"
              sx={{
                color: colors.text.secondary,
                maxWidth: 780,
                lineHeight: 1.5,
                fontWeight: 500,
              }}
            >
              Vista ejecutiva de ventas, inventario, documentos, importaciones y
              entidades comerciales usando datos reales del backend.
            </Typography>

            <Typography
              variant="caption"
              sx={{ color: colors.text.muted, display: "block", mt: 1.5 }}
            >
              Última generación: {formatDateTime(stats?.generated_at)}
            </Typography>
          </Box>

          <Button
            variant="contained"
            startIcon={
              refreshing ? <CircularProgress size={18} /> : <RefreshIcon />
            }
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? "Actualizando..." : "Actualizar"}
          </Button>
        </Stack>
      </Box>

      {errorMessage ? (
        <Alert severity="warning" variant="outlined">
          {errorMessage}
        </Alert>
      ) : null}

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
        <KpiCard
          title="Ventas del mes"
          value={formatCLP(stats?.sales.current_month.total)}
          helper={`${formatNumber(
            stats?.sales.current_month.count,
          )} ventas registradas este mes`}
          icon={<PointOfSaleIcon />}
          accent={colors.modules.sales}
        />

        <KpiCard
          title="Productos activos"
          value={formatNumber(stats?.inventory.products_active)}
          helper={`${formatNumber(
            stats?.inventory.products_control_stock,
          )} productos controlan stock`}
          icon={<Inventory2Icon />}
          accent={colors.modules.inventory}
        />

        <KpiCard
          title="Entidades comerciales"
          value={formatNumber(analytics.commercialTotal)}
          helper={`${formatNumber(
            stats?.general.mineras_active,
          )} mineras y ${formatNumber(stats?.general.contacts_active)} contactos`}
          icon={<BusinessIcon />}
          accent={colors.modules.commercial}
        />

        <KpiCard
          title="Filas por revisar"
          value={formatNumber(analytics.importsPending)}
          helper={`${formatNumber(
            stats?.imports.rows_with_error,
          )} con error y ${formatNumber(
            stats?.imports.rows_requires_review,
          )} requieren revisión`}
          icon={
            analytics.importsPending > 0 ? (
              <WarningAmberIcon />
            ) : (
              <TableChartIcon />
            )
          }
          accent={
            analytics.importsPending > 0
              ? {
                  main: colors.status.warning,
                  soft: colors.status.warningSoft,
                  border: colors.secondary.border,
                }
              : colors.modules.excel
          }
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
          gap: 3,
        }}
      >
        <SectionCard
          title="Inventario"
          description="Estado general de productos, stock y movimientos Kardex."
        >
          <Stack spacing={2.2}>
            <ProgressRow
              label="Productos totales"
              value={stats?.inventory.products_total || 0}
              max={analytics.productsMax}
              helper="Productos registrados en el sistema"
              accent={colors.modules.inventory}
            />

            <ProgressRow
              label="Productos activos"
              value={stats?.inventory.products_active || 0}
              max={analytics.productsMax}
              helper="Productos disponibles operacionalmente"
              accent={colors.modules.inventory}
            />

            <ProgressRow
              label="Controlan stock"
              value={stats?.inventory.products_control_stock || 0}
              max={analytics.productsMax}
              helper="Productos con seguimiento de inventario"
              accent={colors.modules.inventory}
            />

            <ProgressRow
              label="Stock crítico"
              value={stats?.inventory.critical_products_count || 0}
              max={analytics.productsMax}
              helper="Productos bajo umbral mínimo"
              accent={{
                main:
                  (stats?.inventory.critical_products_count || 0) > 0
                    ? colors.status.error
                    : colors.status.success,
                soft:
                  (stats?.inventory.critical_products_count || 0) > 0
                    ? colors.status.errorSoft
                    : colors.status.successSoft,
                border:
                  (stats?.inventory.critical_products_count || 0) > 0
                    ? colors.status.error
                    : colors.status.success,
              }}
            />
          </Stack>
        </SectionCard>

        <SectionCard
          title="Ventas"
          description="Resumen comercial, ventas válidas y alertas activas."
        >
          <Stack spacing={2.2}>
            <ProgressRow
              label="Ventas registradas"
              value={stats?.sales.sales_total || 0}
              max={analytics.salesMax}
              helper="Total histórico de ventas"
              accent={colors.modules.sales}
            />

            <ProgressRow
              label="Ventas válidas"
              value={stats?.sales.sales_valid || 0}
              max={analytics.salesMax}
              helper="Ventas no anuladas"
              accent={colors.modules.sales}
            />

            <ProgressRow
              label="Ventas del mes"
              value={stats?.sales.current_month.count || 0}
              max={analytics.salesMax}
              helper={formatCLP(stats?.sales.current_month.total)}
              accent={colors.modules.sales}
            />

            <ProgressRow
              label="Alertas comerciales"
              value={stats?.sales.active_alerts_count || 0}
              max={analytics.salesMax}
              helper="Alertas activas pendientes de revisión"
              accent={{
                main:
                  (stats?.sales.active_alerts_count || 0) > 0
                    ? colors.status.warning
                    : colors.status.success,
                soft:
                  (stats?.sales.active_alerts_count || 0) > 0
                    ? colors.status.warningSoft
                    : colors.status.successSoft,
                border:
                  (stats?.sales.active_alerts_count || 0) > 0
                    ? colors.secondary.border
                    : colors.status.success,
              }}
            />
          </Stack>
        </SectionCard>

        <SectionCard
          title="Documentos"
          description="Documentos registrados, versiones y versiones activas."
        >
          <Stack spacing={2.2}>
            <ProgressRow
              label="Documentos totales"
              value={stats?.documents.documents_total || 0}
              max={analytics.documentsMax}
              helper="Documentos creados en la plataforma"
              accent={colors.modules.documents}
            />

            <ProgressRow
              label="Documentos activos"
              value={stats?.documents.documents_active || 0}
              max={analytics.documentsMax}
              helper="Documentos disponibles para operación"
              accent={colors.modules.documents}
            />

            <ProgressRow
              label="Versiones totales"
              value={stats?.documents.versions_total || 0}
              max={analytics.documentsMax}
              helper="Historial de versiones registrado"
              accent={colors.modules.documents}
            />

            <ProgressRow
              label="Versiones activas"
              value={stats?.documents.active_versions || 0}
              max={analytics.documentsMax}
              helper="Versiones vigentes actualmente"
              accent={colors.modules.documents}
            />
          </Stack>
        </SectionCard>

        <SectionCard
          title="Importaciones Excel"
          description="Lotes, filas procesadas, errores y revisión manual."
        >
          <Stack spacing={2.2}>
            <ProgressRow
              label="Lotes importados"
              value={stats?.imports.batches_total || 0}
              max={analytics.importsMax}
              helper="Cargas Excel procesadas"
              accent={colors.modules.excel}
            />

            <ProgressRow
              label="Filas totales"
              value={stats?.imports.rows_total || 0}
              max={analytics.importsMax}
              helper="Filas leídas desde archivos"
              accent={colors.modules.excel}
            />

            <ProgressRow
              label="Filas con error"
              value={stats?.imports.rows_with_error || 0}
              max={analytics.importsMax}
              helper="Filas que no pudieron validarse"
              accent={{
                main:
                  (stats?.imports.rows_with_error || 0) > 0
                    ? colors.status.error
                    : colors.status.success,
                soft:
                  (stats?.imports.rows_with_error || 0) > 0
                    ? colors.status.errorSoft
                    : colors.status.successSoft,
                border:
                  (stats?.imports.rows_with_error || 0) > 0
                    ? colors.status.error
                    : colors.status.success,
              }}
            />

            <ProgressRow
              label="Requieren revisión"
              value={stats?.imports.rows_requires_review || 0}
              max={analytics.importsMax}
              helper="Filas con advertencias o datos dudosos"
              accent={{
                main:
                  (stats?.imports.rows_requires_review || 0) > 0
                    ? colors.status.warning
                    : colors.status.success,
                soft:
                  (stats?.imports.rows_requires_review || 0) > 0
                    ? colors.status.warningSoft
                    : colors.status.successSoft,
                border:
                  (stats?.imports.rows_requires_review || 0) > 0
                    ? colors.secondary.border
                    : colors.status.success,
              }}
            />
          </Stack>
        </SectionCard>
      </Box>

      <SectionCard
        title="Resumen comercial"
        description="Base comercial disponible para ventas, documentos y seguimiento."
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(3, minmax(0, 1fr))",
            },
            gap: 2,
          }}
        >
          <KpiCard
            title="Holdings activos"
            value={formatNumber(stats?.general.holdings_active)}
            helper="Agrupadores comerciales principales"
            icon={<BusinessIcon />}
            accent={colors.modules.commercial}
          />

          <KpiCard
            title="Mineras activas"
            value={formatNumber(stats?.general.mineras_active)}
            helper="Clientes mineros operativos"
            icon={<BusinessIcon />}
            accent={colors.modules.commercial}
          />

          <KpiCard
            title="Contactos activos"
            value={formatNumber(stats?.general.contacts_active)}
            helper="Contactos externos disponibles"
            icon={<BusinessIcon />}
            accent={colors.modules.commercial}
          />
        </Box>
      </SectionCard>
    </Stack>
  );
}
