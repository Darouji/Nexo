import { Button, Chip, Stack } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
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

export function buildReceiptColumns(
  onReceive: (receipt: PurchaseReceipt) => void,
): ColDef<PurchaseReceipt>[] {
  return [
    { field: "order_number", colId: "order_line__order__number", headerName: "N° orden", width: 145 },
    {
      field: "product_model",
      colId: "order_line__product_model_snapshot",
      headerName: "Producto / Modelo",
      minWidth: 220,
      flex: 1,
    },
    { field: "status", colId: "pending_receipt__estado", headerName: "Estado", width: 165 },
    { field: "destination_location_name", colId: "destination_location__name", headerName: "Ubicación destino", width: 190 },
    { field: "committed_units", colId: "committed_quantity", headerName: "Cantidad comprometida", width: 190, cellStyle: { textAlign: "right" } },
    { field: "pending_units", colId: "pending_quantity", headerName: "Cantidad pendiente", width: 175, cellStyle: { textAlign: "right" } },
    { field: "received_units", colId: "pending_receipt__cantidad_recibida", headerName: "Cantidad recibida", width: 170, cellStyle: { textAlign: "right" } },
    {
      colId: "actions",
      headerName: "Acciones",
      width: 130,
      sortable: false,
      filter: false,
      cellRenderer: (params: ICellRendererParams<PurchaseReceipt>) =>
        params.data && params.data.pending_units > 0 ? (
          <CapabilityGate capability="purchases.receive_order">
            <Button size="small" variant="contained" onClick={() => onReceive(params.data!)}>
              Recibir
            </Button>
          </CapabilityGate>
        ) : null,
    },
  ];
}
