import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCart";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import type { ReactNode } from "react";
import type { GridColDef, GridValidRowModel } from "@mui/x-data-grid";
import { SmartDataGrid } from "../components/SmartDataGrid";
import { colors } from "../theme/colors";

type PurchaseStatus =
  | "COTIZADA"
  | "COMPRADA"
  | "EN_TRANSITO"
  | "EN_ADUANA"
  | "RECIBIDA_PARCIAL"
  | "RECIBIDA_COMPLETA"
  | "CERRADA"
  | "ANULADA";

type PurchaseCurrency = "CLP" | "USD";

type PurchaseRow = GridValidRowModel & {
  id: number;
  provider: string;
  origin_country: string;
  purchase_type: string;
  purchase_date: string;
  currency: PurchaseCurrency;
  supplier_amount: number;
  exchange_rate: number | null;
  shipping_cost: number;
  customs_cost: number;
  tax_cost: number;
  other_costs: number;
  real_total_clp: number;
  purchase_status: PurchaseStatus;
  shipping_company: string;
  tracking_number: string;
  inventory_impact: string;
};

const purchases: PurchaseRow[] = [
  {
    id: 1,
    provider: "Industrial Parts Chile",
    origin_country: "Chile",
    purchase_type: "Compra inventariable",
    purchase_date: "2026-06-10",
    currency: "CLP",
    supplier_amount: 1850000,
    exchange_rate: null,
    shipping_cost: 45000,
    customs_cost: 0,
    tax_cost: 351500,
    other_costs: 0,
    real_total_clp: 2246500,
    purchase_status: "RECIBIDA_COMPLETA",
    shipping_company: "Proveedor directo",
    tracking_number: "SERKAN-CL-001",
    inventory_impact: "Genera entrada Kardex al recibir",
  },
  {
    id: 2,
    provider: "Gateway Components LLC",
    origin_country: "Estados Unidos",
    purchase_type: "Compra internacional",
    purchase_date: "2026-06-08",
    currency: "USD",
    supplier_amount: 1280,
    exchange_rate: 930,
    shipping_cost: 185000,
    customs_cost: 142000,
    tax_cost: 238000,
    other_costs: 0,
    real_total_clp: 1755400,
    purchase_status: "EN_ADUANA",
    shipping_company: "DHL",
    tracking_number: "DHL-908172CL",
    inventory_impact: "Pendiente hasta recepción",
  },
  {
    id: 3,
    provider: "Servicios Técnicos Norte",
    origin_country: "Chile",
    purchase_type: "Compra no inventariable",
    purchase_date: "2026-06-05",
    currency: "CLP",
    supplier_amount: 420000,
    exchange_rate: null,
    shipping_cost: 0,
    customs_cost: 0,
    tax_cost: 79800,
    other_costs: 25000,
    real_total_clp: 524800,
    purchase_status: "CERRADA",
    shipping_company: "No aplica",
    tracking_number: "Sin seguimiento",
    inventory_impact: "No genera stock",
  },
  {
    id: 4,
    provider: "Mining Supply Global",
    origin_country: "Canadá",
    purchase_type: "Compra internacional",
    purchase_date: "2026-06-01",
    currency: "USD",
    supplier_amount: 2450,
    exchange_rate: 925,
    shipping_cost: 310000,
    customs_cost: 288000,
    tax_cost: 430000,
    other_costs: 65000,
    real_total_clp: 3359250,
    purchase_status: "RECIBIDA_PARCIAL",
    shipping_company: "FedEx",
    tracking_number: "FDX-55420-SRK",
    inventory_impact: "Entrada parcial pendiente",
  },
];

const clpFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function formatClp(value: number) {
  return clpFormatter.format(value);
}

function formatOriginalMoney(value: number, currency: PurchaseCurrency) {
  return currency === "USD"
    ? usdFormatter.format(value)
    : clpFormatter.format(value);
}

function getStatusColor(status: PurchaseStatus) {
  if (status === "CERRADA" || status === "RECIBIDA_COMPLETA") {
    return colors.status.success;
  }

  if (
    status === "EN_TRANSITO" ||
    status === "EN_ADUANA" ||
    status === "RECIBIDA_PARCIAL"
  ) {
    return colors.status.warning;
  }

  if (status === "ANULADA") {
    return colors.status.error;
  }

  return colors.status.info;
}

function getStatusLabel(status: PurchaseStatus) {
  return status.replaceAll("_", " ");
}

type SummaryCardProps = {
  title: string;
  value: string;
  helper: string;
  icon: ReactNode;
  tone: {
    main: string;
    soft: string;
    border: string;
  };
};

function SummaryCard({ title, value, helper, icon, tone }: SummaryCardProps) {
  return (
    <Card
      sx={{
        p: 2.2,
        bgcolor: colors.background.paper,
        border: `1px solid ${colors.border.light}`,
        height: "100%",
      }}
    >
      <Stack direction="row" spacing={1.6} sx={{ alignItems: "center" }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            display: "grid",
            placeItems: "center",
            borderRadius: colors.radius.md,
            color: tone.main,
            bgcolor: tone.soft,
            border: `1px solid ${tone.border}`,
            "& svg": { fontSize: 26 },
          }}
        >
          {icon}
        </Box>

        <Box>
          <Typography variant="body2" sx={{ color: colors.text.secondary }}>
            {title}
          </Typography>

          <Typography
            variant="h5"
            sx={{ color: colors.text.primary, fontWeight: 900 }}
          >
            {value}
          </Typography>

          <Typography variant="caption" sx={{ color: colors.text.muted }}>
            {helper}
          </Typography>
        </Box>
      </Stack>
    </Card>
  );
}

export function PurchasesPage() {
  const totalRealClp = purchases.reduce(
    (sum, purchase) => sum + purchase.real_total_clp,
    0,
  );

  const internationalCount = purchases.filter(
    (purchase) => purchase.currency === "USD",
  ).length;

  const pendingReceptionCount = purchases.filter((purchase) =>
    ["EN_TRANSITO", "EN_ADUANA", "RECIBIDA_PARCIAL"].includes(
      purchase.purchase_status,
    ),
  ).length;

  const columns: GridColDef[] = [
    { field: "provider", headerName: "Proveedor", minWidth: 210, flex: 1 },
    { field: "origin_country", headerName: "País origen", width: 140 },
    { field: "purchase_type", headerName: "Tipo compra", width: 190 },
    { field: "purchase_date", headerName: "Fecha", width: 120 },
    {
      field: "supplier_amount",
      headerName: "Monto proveedor",
      width: 170,
      renderCell: (params) =>
        formatOriginalMoney(Number(params.value), params.row.currency),
    },
    {
      field: "exchange_rate",
      headerName: "Tipo cambio",
      width: 130,
      renderCell: (params) =>
        params.value
          ? `$${Number(params.value).toLocaleString("es-CL")}`
          : "No aplica",
    },
    {
      field: "shipping_cost",
      headerName: "Envío CLP",
      width: 135,
      renderCell: (params) => formatClp(Number(params.value)),
    },
    {
      field: "customs_cost",
      headerName: "Aduana CLP",
      width: 140,
      renderCell: (params) => formatClp(Number(params.value)),
    },
    {
      field: "tax_cost",
      headerName: "Impuestos CLP",
      width: 150,
      renderCell: (params) => formatClp(Number(params.value)),
    },
    {
      field: "other_costs",
      headerName: "Otros CLP",
      width: 130,
      renderCell: (params) => formatClp(Number(params.value)),
    },
    {
      field: "real_total_clp",
      headerName: "Costo real CLP",
      width: 170,
      renderCell: (params) => (
        <Typography sx={{ fontWeight: 900 }}>
          {formatClp(Number(params.value))}
        </Typography>
      ),
    },
    {
      field: "purchase_status",
      headerName: "Estado compra",
      width: 180,
      renderCell: (params) => {
        const status = params.value as PurchaseStatus;
        const color = getStatusColor(status);

        return (
          <Chip
            label={getStatusLabel(status)}
            size="small"
            sx={{
              color,
              bgcolor: colors.surface.soft,
              borderColor: color,
              border: "1px solid",
              fontWeight: 800,
            }}
          />
        );
      },
    },
    { field: "shipping_company", headerName: "Empresa envío", width: 160 },
    { field: "tracking_number", headerName: "Seguimiento", width: 170 },
    { field: "inventory_impact", headerName: "Impacto inventario", width: 230 },
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{
            alignItems: { xs: "flex-start", md: "center" },
            justifyContent: "space-between",
          }}
        >
          <Box>
            <Typography
              variant="h4"
              sx={{ color: colors.text.primary, fontWeight: 900 }}
            >
              Compras / Egresos
            </Typography>

            <Typography variant="body2" sx={{ color: colors.text.secondary }}>
              Abastecimiento nacional e internacional, costos reales, recepción,
              documentos y relación futura con inventario.
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
            <Button
              variant="contained"
              startIcon={<AddShoppingCartIcon />}
              disabled
            >
              Registrar compra
            </Button>

            <Button variant="outlined" startIcon={<ReceiptLongIcon />} disabled>
              Adjuntar documento
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Alert severity="info" variant="outlined">
        Este apartado es frontend temprano: muestra estructura visual y datos de
        prueba. No guarda compras, no modifica inventario y no crea Kardex hasta
        que exista endpoint backend validado.
      </Alert>

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
        <SummaryCard
          title="Compras registradas"
          value={String(purchases.length)}
          helper="Muestra operativa de prueba"
          icon={<ReceiptLongIcon />}
          tone={colors.modules.purchases}
        />

        <SummaryCard
          title="Costo real total"
          value={formatClp(totalRealClp)}
          helper="Proveedor + envío + aduana + impuestos"
          icon={<AttachMoneyIcon />}
          tone={colors.modules.analytics}
        />

        <SummaryCard
          title="Compras internacionales"
          value={String(internationalCount)}
          helper="Con tipo de cambio manual congelado"
          icon={<LocalShippingIcon />}
          tone={colors.modules.documents}
        />

        <SummaryCard
          title="Pendientes de recepción"
          value={String(pendingReceptionCount)}
          helper="Tránsito, aduana o recepción parcial"
          icon={<Inventory2Icon />}
          tone={colors.modules.inventory}
        />
      </Box>

      <Card
        sx={{
          p: 2.2,
          bgcolor: colors.background.paper,
          border: `1px solid ${colors.border.light}`,
        }}
      >
        <Typography
          variant="h6"
          sx={{ color: colors.text.primary, fontWeight: 900, mb: 1 }}
        >
          Reglas visibles del módulo
        </Typography>

        <Divider sx={{ borderColor: colors.border.light, mb: 2 }} />

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
            gap: 2,
          }}
        >
          <Typography variant="body2" sx={{ color: colors.text.secondary }}>
            Las compras pueden ser nacionales o internacionales, inventariables
            o no inventariables.
          </Typography>

          <Typography variant="body2" sx={{ color: colors.text.secondary }}>
            Las compras en USD deben conservar el tipo de cambio usado al
            momento del registro.
          </Typography>

          <Typography variant="body2" sx={{ color: colors.text.secondary }}>
            El costo real considera proveedor, envío, aduana, impuestos y otros
            costos operativos.
          </Typography>
        </Box>
      </Card>

      <SmartDataGrid rows={purchases} columns={columns} />
    </Box>
  );
}
