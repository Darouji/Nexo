import { Button, Chip, Stack } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import HistoryIcon from "@mui/icons-material/History";
import DeleteIcon from "@mui/icons-material/Delete";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { colors } from "../../theme/colors";
import { CapabilityGate } from "../../components/CapabilityGate";
import type {
  PurchaseOrder,
  PurchaseOrderStatus,
  PurchaseReceipt,
  Supplier,
} from "../../services/purchasesService";
import { formatPurchaseStatus } from "./purchaseModels";

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

function money(value: unknown, currency: string) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: currency === "USD" ? "USD" : "CLP",
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(Number(value || 0));
}
function statusColor(status: PurchaseOrderStatus) {
  if (["RECIBIDA", "CERRADA"].includes(status)) return colors.status.success;
  if (["CANCELADA"].includes(status)) return colors.status.error;
  if (["EN_REVISION", "PARCIALMENTE_RECIBIDA"].includes(status)) {
    return colors.status.warning;
  }
  return colors.status.info;
}

export function buildOrderColumns(
  onView: (order: PurchaseOrder) => void,
): ColDef<PurchaseOrder>[] {
  return [
    { field: "number", colId: "number", headerName: "N° orden", minWidth: 145 },
    {
      field: "supplier_name",
      colId: "supplier__legal_name",
      headerName: "Proveedor",
      minWidth: 220,
      flex: 1,
    },
    { field: "issue_date", colId: "order_date", headerName: "Emisión", width: 130 },
    {
      field: "expected_date",
      colId: "expected_date",
      headerName: "Recepción esperada",
      width: 175,
      valueFormatter: (params) => String(params.value || "Sin fecha"),
    },
    { field: "currency", colId: "currency", headerName: "Moneda", width: 105 },
    {
      field: "supplier_amount",
      colId: "subtotal_original",
      headerName: "Monto neto",
      width: 155,
      cellStyle: { textAlign: "right", fontVariantNumeric: "tabular-nums" },
      valueFormatter: (params) => money(params.value, params.data?.currency || "CLP"),
    },
    {
      field: "tax_amount",
      colId: "tax_total_original",
      headerName: "IVA (19%)",
      width: 145,
      cellStyle: { textAlign: "right", fontVariantNumeric: "tabular-nums" },
      valueFormatter: (params) => money(params.value, params.data?.currency || "CLP"),
    },
    {
      field: "total_original",
      colId: "total_original",
      headerName: "Total con IVA",
      width: 165,
      cellStyle: { textAlign: "right", fontVariantNumeric: "tabular-nums" },
      valueFormatter: (params) => money(params.value, params.data?.currency || "CLP"),
    },
    {
      field: "total_clp",
      colId: "total_clp",
      headerName: "Total CLP",
      width: 160,
      cellStyle: { textAlign: "right", fontVariantNumeric: "tabular-nums" },
      valueFormatter: (params) => clp.format(Number(params.value || 0)),
    },
    {
      field: "status",
      colId: "state",
      headerName: "Estado",
      width: 190,
      cellRenderer: (
        params: ICellRendererParams<PurchaseOrder, PurchaseOrderStatus>,
      ) => {
        const status = params.value || "BORRADOR";
        const color = statusColor(status);
        return (
          <Stack sx={{ height: "100%", justifyContent: "center", alignItems: "flex-start" }}>
            <Chip
              size="small"
              label={formatPurchaseStatus(status)}
              sx={{ color, border: `1px solid ${color}`, fontWeight: 800 }}
            />
          </Stack>
        );
      },
    },
    {
      colId: "actions",
      headerName: "Acciones",
      width: 120,
      sortable: false,
      filter: false,
      cellRenderer: (params: ICellRendererParams<PurchaseOrder>) =>
        params.data ? (
          <Button
            size="small"
            variant="outlined"
            startIcon={<VisibilityIcon />}
            onClick={() => onView(params.data!)}
          >
            Ver
          </Button>
        ) : null,
    },
  ];
}

export function buildSupplierColumns(): ColDef<Supplier>[] {
  return [
    { field: "tax_id", colId: "tax_id", headerName: "RUT / Identificación", width: 180 },
    { field: "name", colId: "legal_name", headerName: "Razón social", minWidth: 240, flex: 1 },
    { field: "country", colId: "country", headerName: "País", width: 145 },
    { field: "contact_name", colId: "contact_name", headerName: "Contacto", width: 190 },
    { field: "email", colId: "email", headerName: "Correo", minWidth: 220 },
    {
      field: "active",
      colId: "status",
      headerName: "Estado",
      width: 120,
      valueFormatter: (params) => (params.value ? "Activo" : "Inactivo"),
    },
  ];
}

export function buildReceiptColumns({
  onReceive,
  onCancel,
  onHistory,
}: {
  onReceive: (receipt: PurchaseReceipt) => void;
  onCancel: (receipt: PurchaseReceipt) => void;
  onHistory: (receipt: PurchaseReceipt) => void;
}): ColDef<PurchaseReceipt>[] {
  return [
    {
      field: "product_model",
      colId: "producto__modelo_normalized",
      headerName: "Producto / Modelo",
      minWidth: 220,
      flex: 1,
    },
    { field: "product_category", colId: "producto__categoria__name_normalized", headerName: "Categoría", width: 155 },
    { field: "supplier_name", colId: "supplier", headerName: "Proveedor", minWidth: 190 },
    { field: "product_sap", colId: "producto__codigo_sap_normalized", headerName: "Código SAP", width: 145 },
    {
      field: "order_number",
      colId: "referencia",
      headerName: "OC / Factura",
      width: 175,
      valueFormatter: (params) => String(params.value || params.data?.reference || "Sin referencia"),
    },
    { field: "destination_location_name", colId: "destination_location__name_normalized", headerName: "Ubicación de recepción", width: 205 },
    { field: "committed_units", colId: "cantidad_original", headerName: "Cantidad original", width: 155, cellStyle: { textAlign: "right" } },
    { field: "received_units", colId: "cantidad_recibida", headerName: "Cantidad recibida", width: 150, cellStyle: { textAlign: "right" } },
    { field: "cancelled_units", colId: "cantidad_cancelada", headerName: "Cantidad cancelada", width: 155, cellStyle: { textAlign: "right" } },
    { field: "pending_units", colId: "cantidad_pendiente_orden", headerName: "Cantidad pendiente", width: 160, cellStyle: { textAlign: "right" } },
    { field: "status_display", colId: "estado", headerName: "Estado", width: 165 },
    { field: "origin_display", colId: "origin", headerName: "Origen", width: 155 },
    {
      colId: "actions",
      headerName: "Acciones",
      width: 325,
      sortable: false,
      filter: false,
      cellRenderer: (params: ICellRendererParams<PurchaseReceipt>) => {
        const receipt = params.data;
        if (!receipt) return null;
        const canOperate = receipt.pending_units > 0 && ["PENDIENTE", "PARCIAL"].includes(receipt.status);
        return (
          <Stack direction="row" spacing={0.5} sx={{ height: "100%", alignItems: "center" }}>
            <Button size="small" startIcon={<HistoryIcon />} onClick={() => onHistory(receipt)}>
              Historial
            </Button>
            <CapabilityGate capability="purchases.receive_order">
              <Button size="small" variant="contained" disabled={!canOperate} onClick={() => onReceive(receipt)}>
                Recibir
              </Button>
            </CapabilityGate>
            <CapabilityGate capability="purchases.cancel_order">
              <Button size="small" color="error" startIcon={<DeleteIcon />} disabled={!canOperate} onClick={() => onCancel(receipt)}>
                Cancelar
              </Button>
            </CapabilityGate>
          </Stack>
        );
      },
    },
  ];
}
