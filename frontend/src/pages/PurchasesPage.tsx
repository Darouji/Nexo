import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCart";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
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
  notes: string;
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
    notes: "Compra nacional recibida completamente.",
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
    notes: "Compra internacional en revisión aduanera.",
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
    notes: "Servicio técnico asociado a operación interna.",
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
    notes: "Recepción parcial; queda mercadería pendiente.",
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

function normalizeSearch(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
  }).format(date);
}

function getStatusLabel(status: PurchaseStatus) {
  return status.replaceAll("_", " ");
}

function getStatusAccent(status: PurchaseStatus) {
  if (status === "CERRADA" || status === "RECIBIDA_COMPLETA") {
    return {
      main: colors.status.success,
      soft: colors.status.successSoft,
      border: colors.status.success,
    };
  }

  if (
    status === "EN_TRANSITO" ||
    status === "EN_ADUANA" ||
    status === "RECIBIDA_PARCIAL"
  ) {
    return {
      main: colors.status.warning,
      soft: colors.status.warningSoft,
      border: colors.secondary.border,
    };
  }

  if (status === "ANULADA") {
    return {
      main: colors.status.error,
      soft: colors.status.errorSoft,
      border: colors.status.error,
    };
  }

  return {
    main: colors.status.info,
    soft: colors.status.infoSoft,
    border: colors.status.info,
  };
}

function StatusChip({ status }: { status: PurchaseStatus }) {
  const accent = getStatusAccent(status);

  return (
    <Chip
      label={getStatusLabel(status)}
      size="small"
      variant="outlined"
      sx={{
        color: accent.main,
        bgcolor: accent.soft,
        borderColor: accent.border,
        fontWeight: 850,
      }}
    />
  );
}

function SummaryCard({
  title,
  value,
  helper,
  icon,
  tone,
}: {
  title: string;
  value: string;
  helper: string;
  icon: ReactNode;
  tone: {
    main: string;
    soft: string;
    border: string;
  };
}) {
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
        <Stack direction="row" spacing={1.6} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 46,
              height: 46,
              display: "grid",
              placeItems: "center",
              borderRadius: colors.radius.md,
              color: tone.main,
              bgcolor: tone.soft,
              border: `1px solid ${tone.border}`,
              "& svg": { fontSize: 27 },
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
              sx={{ color: colors.text.primary, fontWeight: 950 }}
            >
              {value}
            </Typography>

            <Typography variant="caption" sx={{ color: colors.text.muted }}>
              {helper}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function PurchasesPage() {
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseRow | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState("");

  const filteredPurchases = useMemo(() => {
    const term = normalizeSearch(searchTerm.trim());

    return purchases.filter((purchase) => {
      const matchesSearch = term
        ? [
            purchase.provider,
            purchase.origin_country,
            purchase.purchase_type,
            purchase.purchase_status,
            purchase.shipping_company,
            purchase.tracking_number,
            purchase.inventory_impact,
            purchase.notes,
          ].some((value) => normalizeSearch(value).includes(term))
        : true;

      const matchesStatus = statusFilter
        ? purchase.purchase_status === statusFilter
        : true;

      const matchesCurrency = currencyFilter
        ? purchase.currency === currencyFilter
        : true;

      return matchesSearch && matchesStatus && matchesCurrency;
    });
  }, [currencyFilter, searchTerm, statusFilter]);

  const summary = useMemo(() => {
    const totalRealClp = filteredPurchases.reduce(
      (sum, purchase) => sum + purchase.real_total_clp,
      0,
    );

    const internationalCount = filteredPurchases.filter(
      (purchase) => purchase.currency === "USD",
    ).length;

    const pendingReceptionCount = filteredPurchases.filter((purchase) =>
      ["EN_TRANSITO", "EN_ADUANA", "RECIBIDA_PARCIAL"].includes(
        purchase.purchase_status,
      ),
    ).length;

    const inventoryImpactCount = filteredPurchases.filter(
      (purchase) =>
        purchase.inventory_impact.toLowerCase().includes("kardex") ||
        purchase.inventory_impact.toLowerCase().includes("entrada"),
    ).length;

    return {
      totalRealClp,
      internationalCount,
      pendingReceptionCount,
      inventoryImpactCount,
    };
  }, [filteredPurchases]);

  const columns = useMemo<GridColDef[]>(() => {
    return [
      {
        field: "provider",
        headerName: "Proveedor",
        minWidth: 220,
        flex: 1,
      },
      {
        field: "origin_country",
        headerName: "País",
        width: 135,
      },
      {
        field: "purchase_type",
        headerName: "Tipo compra",
        minWidth: 190,
        flex: 0.7,
      },
      {
        field: "purchase_date",
        headerName: "Fecha",
        width: 145,
        renderCell: (params) => formatDate(String(params.value || "")),
      },
      {
        field: "currency",
        headerName: "Moneda",
        width: 105,
      },
      {
        field: "supplier_amount",
        headerName: "Monto proveedor",
        width: 170,
        renderCell: (params) => {
          const purchase = params.row as PurchaseRow;

          return formatOriginalMoney(
            Number(params.value || 0),
            purchase.currency,
          );
        },
      },
      {
        field: "exchange_rate",
        headerName: "Tipo cambio",
        width: 135,
        renderCell: (params) =>
          params.value
            ? `$${Number(params.value).toLocaleString("es-CL")}`
            : "No aplica",
      },
      {
        field: "real_total_clp",
        headerName: "Costo real CLP",
        width: 170,
        renderCell: (params) => (
          <Typography sx={{ color: colors.text.primary, fontWeight: 900 }}>
            {formatClp(Number(params.value || 0))}
          </Typography>
        ),
      },
      {
        field: "purchase_status",
        headerName: "Estado",
        width: 185,
        renderCell: (params) => (
          <StatusChip status={params.value as PurchaseStatus} />
        ),
      },
      {
        field: "shipping_company",
        headerName: "Envío",
        width: 160,
      },
      {
        field: "tracking_number",
        headerName: "Seguimiento",
        width: 170,
      },
      {
        field: "inventory_impact",
        headerName: "Impacto inventario",
        minWidth: 230,
        flex: 1,
      },
      {
        field: "actions",
        headerName: "Acciones",
        width: 120,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Button
            size="small"
            variant="outlined"
            startIcon={<VisibilityIcon />}
            onClick={(event) => {
              event.stopPropagation();
              setSelectedPurchase(params.row as PurchaseRow);
            }}
          >
            Ver
          </Button>
        ),
      },
    ];
  }, []);

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
              label="Abastecimiento y egresos"
              icon={<ReceiptLongIcon />}
              variant="outlined"
              size="small"
              sx={{
                mb: 2,
                color: colors.modules.purchases.main,
                bgcolor: colors.modules.purchases.soft,
                borderColor: colors.modules.purchases.border,
                fontWeight: 850,
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
              Compras / Egresos
            </Typography>

            <Typography
              variant="h6"
              sx={{
                color: colors.text.secondary,
                maxWidth: 840,
                lineHeight: 1.5,
                fontWeight: 500,
              }}
            >
              Vista preliminar para compras nacionales e internacionales, costos
              reales, seguimiento logístico y recepción inventariable.
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              variant="contained"
              startIcon={<AddShoppingCartIcon />}
              disabled
              title="Se activará cuando exista endpoint backend validado."
            >
              Registrar compra
            </Button>

            <Button
              variant="outlined"
              startIcon={<ReceiptLongIcon />}
              disabled
              sx={{
                color: colors.text.primary,
                borderColor: colors.border.medium,
              }}
              title="Se activará junto al módulo documental asociado a compras."
            >
              Adjuntar documento
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Alert severity="info" variant="outlined">
        Este módulo sigue siendo frontend demostrativo: no guarda compras, no
        modifica inventario y no crea Kardex hasta que exista endpoint backend
        validado.
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
          title="Compras visibles"
          value={String(filteredPurchases.length)}
          helper="Registros demostrativos filtrados"
          icon={<ReceiptLongIcon />}
          tone={colors.modules.purchases}
        />

        <SummaryCard
          title="Costo real total"
          value={formatClp(summary.totalRealClp)}
          helper="Proveedor + envío + aduana + impuestos"
          icon={<AttachMoneyIcon />}
          tone={colors.modules.analytics}
        />

        <SummaryCard
          title="Internacionales"
          value={String(summary.internationalCount)}
          helper="Compras con moneda USD"
          icon={<LocalShippingIcon />}
          tone={colors.modules.documents}
        />

        <SummaryCard
          title="Pendientes recepción"
          value={String(summary.pendingReceptionCount)}
          helper={`${summary.inventoryImpactCount} con impacto inventariable`}
          icon={<Inventory2Icon />}
          tone={colors.modules.inventory}
        />
      </Box>

      <Card
        sx={{
          bgcolor: colors.background.paper,
          border: `1px solid ${colors.border.light}`,
          boxShadow: colors.shadow.card,
        }}
      >
        <CardContent>
          <Stack spacing={2.5}>
            <Stack
              direction={{ xs: "column", lg: "row" }}
              spacing={2}
              sx={{
                alignItems: { xs: "stretch", lg: "center" },
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Typography
                  variant="h5"
                  sx={{ color: colors.text.primary, fontWeight: 900 }}
                >
                  Control preliminar de compras
                </Typography>

                <Typography variant="body2" sx={{ color: colors.text.muted }}>
                  Busca por proveedor, país, tipo, estado, seguimiento o impacto
                  en inventario.
                </Typography>
              </Box>

              <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                <TextField
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar compras..."
                  size="small"
                  sx={{ minWidth: { xs: "100%", md: 280 } }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    },
                  }}
                />

                <TextField
                  select
                  label="Estado"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  size="small"
                  sx={{ minWidth: { xs: "100%", md: 200 } }}
                >
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="COTIZADA">Cotizada</MenuItem>
                  <MenuItem value="COMPRADA">Comprada</MenuItem>
                  <MenuItem value="EN_TRANSITO">En tránsito</MenuItem>
                  <MenuItem value="EN_ADUANA">En aduana</MenuItem>
                  <MenuItem value="RECIBIDA_PARCIAL">Recibida parcial</MenuItem>
                  <MenuItem value="RECIBIDA_COMPLETA">
                    Recibida completa
                  </MenuItem>
                  <MenuItem value="CERRADA">Cerrada</MenuItem>
                  <MenuItem value="ANULADA">Anulada</MenuItem>
                </TextField>

                <TextField
                  select
                  label="Moneda"
                  value={currencyFilter}
                  onChange={(event) => setCurrencyFilter(event.target.value)}
                  size="small"
                  sx={{ minWidth: { xs: "100%", md: 135 } }}
                >
                  <MenuItem value="">Todas</MenuItem>
                  <MenuItem value="CLP">CLP</MenuItem>
                  <MenuItem value="USD">USD</MenuItem>
                </TextField>
              </Stack>
            </Stack>

            <SmartDataGrid rows={filteredPurchases} columns={columns} />
          </Stack>
        </CardContent>
      </Card>

      <Card
        sx={{
          bgcolor: colors.background.paper,
          border: `1px solid ${colors.border.light}`,
          boxShadow: colors.shadow.card,
        }}
      >
        <CardContent>
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
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(3, minmax(0, 1fr))",
              },
              gap: 2,
            }}
          >
            <Typography variant="body2" sx={{ color: colors.text.secondary }}>
              Las compras pueden ser nacionales o internacionales,
              inventariables o no inventariables.
            </Typography>

            <Typography variant="body2" sx={{ color: colors.text.secondary }}>
              Las compras en USD deben conservar el tipo de cambio usado al
              momento del registro.
            </Typography>

            <Typography variant="body2" sx={{ color: colors.text.secondary }}>
              El costo real considera proveedor, envío, aduana, impuestos y
              otros costos operativos.
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedPurchase)}
        onClose={() => setSelectedPurchase(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {selectedPurchase?.provider || "Detalle de compra"}
        </DialogTitle>

        <DialogContent>
          {selectedPurchase ? (
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                <StatusChip status={selectedPurchase.purchase_status} />

                <Chip
                  label={selectedPurchase.currency}
                  size="small"
                  variant="outlined"
                  sx={{
                    color: colors.modules.purchases.main,
                    bgcolor: colors.modules.purchases.soft,
                    borderColor: colors.modules.purchases.border,
                    fontWeight: 850,
                  }}
                />

                <Chip
                  label={selectedPurchase.purchase_type}
                  size="small"
                  variant="outlined"
                  sx={{
                    color: colors.text.secondary,
                    bgcolor: colors.action.muted,
                    borderColor: colors.border.medium,
                    fontWeight: 850,
                  }}
                />
              </Stack>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "repeat(2, minmax(0, 1fr))",
                  },
                  gap: 2,
                }}
              >
                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: colors.text.secondary, fontWeight: 800 }}
                  >
                    Proveedor
                  </Typography>

                  <Typography sx={{ color: colors.text.primary }}>
                    {selectedPurchase.provider}
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: colors.text.secondary, fontWeight: 800 }}
                  >
                    País origen
                  </Typography>

                  <Typography sx={{ color: colors.text.primary }}>
                    {selectedPurchase.origin_country}
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: colors.text.secondary, fontWeight: 800 }}
                  >
                    Fecha compra
                  </Typography>

                  <Typography sx={{ color: colors.text.primary }}>
                    {formatDate(selectedPurchase.purchase_date)}
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: colors.text.secondary, fontWeight: 800 }}
                  >
                    Monto proveedor
                  </Typography>

                  <Typography sx={{ color: colors.text.primary }}>
                    {formatOriginalMoney(
                      selectedPurchase.supplier_amount,
                      selectedPurchase.currency,
                    )}
                  </Typography>

                  <Typography
                    variant="caption"
                    sx={{ color: colors.text.muted }}
                  >
                    Tipo cambio:{" "}
                    {selectedPurchase.exchange_rate
                      ? `$${selectedPurchase.exchange_rate.toLocaleString(
                          "es-CL",
                        )}`
                      : "No aplica"}
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: colors.text.secondary, fontWeight: 800 }}
                  >
                    Envío / tracking
                  </Typography>

                  <Typography sx={{ color: colors.text.primary }}>
                    {selectedPurchase.shipping_company}
                  </Typography>

                  <Typography
                    variant="caption"
                    sx={{ color: colors.text.muted }}
                  >
                    {selectedPurchase.tracking_number}
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: colors.text.secondary, fontWeight: 800 }}
                  >
                    Impacto inventario
                  </Typography>

                  <Typography sx={{ color: colors.text.primary }}>
                    {selectedPurchase.inventory_impact}
                  </Typography>
                </Box>
              </Box>

              <Divider />

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, minmax(0, 1fr))",
                    md: "repeat(5, minmax(0, 1fr))",
                  },
                  gap: 1.5,
                }}
              >
                {[
                  ["Envío", selectedPurchase.shipping_cost],
                  ["Aduana", selectedPurchase.customs_cost],
                  ["Impuestos", selectedPurchase.tax_cost],
                  ["Otros", selectedPurchase.other_costs],
                  ["Total real", selectedPurchase.real_total_clp],
                ].map(([label, value]) => (
                  <Card
                    key={String(label)}
                    variant="outlined"
                    sx={{ borderColor: colors.border.light }}
                  >
                    <CardContent>
                      <Typography
                        variant="caption"
                        sx={{ color: colors.text.muted }}
                      >
                        {label}
                      </Typography>

                      <Typography
                        sx={{ color: colors.text.primary, fontWeight: 900 }}
                      >
                        {formatClp(Number(value || 0))}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>

              <Box>
                <Typography
                  variant="body2"
                  sx={{ color: colors.text.secondary, fontWeight: 800 }}
                >
                  Notas
                </Typography>

                <Typography sx={{ color: colors.text.primary }}>
                  {selectedPurchase.notes}
                </Typography>
              </Box>
            </Stack>
          ) : null}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setSelectedPurchase(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
