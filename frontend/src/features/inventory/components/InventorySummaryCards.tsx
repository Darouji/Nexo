import Inventory2Icon from "@mui/icons-material/Inventory2";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import WarehouseOutlinedIcon from "@mui/icons-material/WarehouseOutlined";
import { Box } from "@mui/material";

import { MetricCard } from "../../../components/MetricCard";
import type { InventorySummary } from "../../../services/inventoryService";
import { colors } from "../../../theme/colors";

const chileanNumberFormatter = new Intl.NumberFormat("es-CL");

function formatNumber(value: number | null | undefined) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? chileanNumberFormatter.format(numericValue)
    : "—";
}

type InventorySummaryCardsProps = {
  summary: InventorySummary;
};

export function InventorySummaryCards({
  summary,
}: InventorySummaryCardsProps) {
  return (
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
      <MetricCard
        title="Productos activos"
        value={formatNumber(summary.productos_activos)}
        helper="Disponibles en el catálogo operativo"
        icon={<Inventory2Icon />}
        tone={colors.modules.inventory}
      />

      <MetricCard
        title="Stock físico total"
        value={formatNumber(summary.stock_fisico_total)}
        helper="Unidades registradas en todas las ubicaciones"
        icon={<WarehouseOutlinedIcon />}
        tone={colors.modules.inventory}
      />

      <MetricCard
        title="Bajo mínimo"
        value={formatNumber(summary.bajo_minimo)}
        helper="Productos que requieren reposición"
        icon={<WarningAmberIcon />}
        tone={{
          main: colors.status.warning,
          soft: colors.status.warningSoft,
          border: colors.status.warning,
        }}
      />

      <MetricCard
        title="Por recibir"
        value={formatNumber(summary.por_recibir)}
        helper="Unidades pendientes de recepción física"
        icon={<LocalShippingIcon />}
        tone={{
          main: colors.status.warning,
          soft: colors.status.warningSoft,
          border: colors.secondary.border,
        }}
      />
    </Box>
  );
}
