import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import type { DashboardStatistics } from "../../services/coreService";
import { colors } from "../../theme/colors";

type SalesStats = DashboardStatistics["sales"];

function formatCLP(value: string | number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat("es-CL", { month: "short", year: "2-digit" }).format(
    new Date(year, month - 1, 1),
  );
}

function RankingCard({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: Array<{ id: number; label: string; value: number; helper: string }>;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <Card sx={{ height: "100%", bgcolor: colors.background.paper, border: `1px solid ${colors.border.light}` }}>
      <CardContent>
        <Typography variant="h6" sx={{ color: colors.text.primary, fontWeight: 900 }}>{title}</Typography>
        <Typography variant="body2" sx={{ color: colors.text.muted, mb: 2 }}>{description}</Typography>
        <Stack spacing={1.5}>
          {rows.length ? rows.map((row, index) => (
            <Box key={row.id}>
              <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1, mb: 0.55 }}>
                <Typography variant="body2" noWrap sx={{ color: colors.text.primary, fontWeight: 800 }}>
                  {index + 1}. {row.label}
                </Typography>
                <Typography variant="caption" sx={{ color: colors.modules.analytics.main, fontWeight: 900, whiteSpace: "nowrap" }}>
                  {row.helper}
                </Typography>
              </Stack>
              <Box sx={{ height: 8, borderRadius: 99, bgcolor: colors.surface.muted, overflow: "hidden" }}>
                <Box sx={{ width: `${Math.max(4, (row.value / max) * 100)}%`, height: "100%", bgcolor: colors.modules.analytics.main, borderRadius: 99 }} />
              </Box>
            </Box>
          )) : (
            <Typography variant="body2" sx={{ color: colors.text.muted }}>No hay ventas en este período.</Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

export function SalesAnalyticsCharts({ sales }: { sales: SalesStats }) {
  const monthlyMax = Math.max(...sales.last_six_months.map((item) => Number(item.total)), 1);

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "1.25fr 1fr" }, gap: 2.5 }}>
      <Card sx={{ bgcolor: colors.background.paper, border: `1px solid ${colors.border.light}` }}>
        <CardContent>
          <Typography variant="h6" sx={{ color: colors.text.primary, fontWeight: 900 }}>Evolución de ventas</Typography>
          <Typography variant="body2" sx={{ color: colors.text.muted }}>Monto total mensual dentro del período seleccionado.</Typography>
          <Stack direction="row" spacing={1.2} sx={{ height: 230, alignItems: "flex-end", mt: 3, pb: 1 }}>
            {sales.last_six_months.length ? sales.last_six_months.map((item) => {
              const total = Number(item.total);
              return (
                <Stack key={item.month} spacing={0.7} sx={{ flex: 1, minWidth: 0, alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                  <Typography variant="caption" sx={{ color: colors.text.secondary, fontWeight: 800 }}>{formatCLP(total)}</Typography>
                  <Box
                    title={`${item.count} ventas · ${formatCLP(total)}`}
                    sx={{
                      width: "100%",
                      maxWidth: 66,
                      minHeight: 6,
                      height: `${Math.max(4, (total / monthlyMax) * 78)}%`,
                      borderRadius: `${colors.radius.sm} ${colors.radius.sm} 3px 3px`,
                      background: `linear-gradient(180deg, ${colors.modules.sales.main}, ${colors.primary.main})`,
                      boxShadow: colors.modules.sales.shadow,
                    }}
                  />
                  <Typography variant="caption" noWrap sx={{ color: colors.text.muted }}>{formatMonth(item.month)}</Typography>
                </Stack>
              );
            }) : <Typography sx={{ color: colors.text.muted }}>No hay ventas en este período.</Typography>}
          </Stack>
        </CardContent>
      </Card>

      <RankingCard
        title="Productos más vendidos"
        description="Ranking real por unidades vendidas. El monto indica ingresos, no utilidad."
        rows={sales.top_products.map((item) => ({
          id: item.id,
          label: item.label,
          value: item.quantity,
          helper: `${item.quantity} un. · ${formatCLP(item.revenue)}`,
        }))}
      />

      <RankingCard
        title="Mineras con mayor compra"
        description="Ordenadas por monto vendido en el período."
        rows={sales.top_mineras.map((item) => ({ id: item.id, label: item.label, value: Number(item.revenue), helper: formatCLP(item.revenue) }))}
      />

      <RankingCard
        title="Contactos con mayor compra"
        description="Contactos asociados a ventas, ordenados por monto."
        rows={sales.top_contacts.map((item) => ({ id: item.id, label: item.label, value: Number(item.revenue), helper: formatCLP(item.revenue) }))}
      />
    </Box>
  );
}
