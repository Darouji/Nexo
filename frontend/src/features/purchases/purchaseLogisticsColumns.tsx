import LaunchIcon from "@mui/icons-material/Launch";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { Button, Chip, Stack, Typography } from "@mui/material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";

import type {
  PurchaseShipment,
  ShipmentStatus,
} from "../../services/purchasesLogisticsService";
import { colors } from "../../theme/colors";

function shipmentStatusColor(status: ShipmentStatus) {
  if (status === "ENTREGADO") return colors.status.success;
  if (["CANCELADO", "CON_INCIDENCIA", "RETENIDO"].includes(status)) {
    return colors.status.error;
  }
  if (["EN_ADUANA", "EN_REPARTO"].includes(status)) {
    return colors.status.warning;
  }
  return colors.status.info;
}

function remainingLabel(days: number | null) {
  if (days === null) return "Sin estimación";
  if (days < 0) return `${Math.abs(days)} día(s) de atraso`;
  if (days === 0) return "Llegada estimada hoy";
  return `${days} día(s) restantes`;
}

export function buildShipmentColumns(
  onView: (shipment: PurchaseShipment) => void,
): ColDef<PurchaseShipment>[] {
  return [
    {
      field: "order_number",
      colId: "order__number",
      headerName: "Orden de compra",
      width: 165,
    },
    {
      field: "supplier_name",
      colId: "order__supplier__legal_name",
      headerName: "Proveedor",
      minWidth: 220,
      flex: 1,
    },
    {
      field: "carrier_name",
      colId: "carrier__name",
      headerName: "Empresa transportista",
      minWidth: 210,
    },
    {
      field: "tracking_number",
      colId: "tracking_number",
      headerName: "Seguimiento",
      minWidth: 190,
      cellRenderer: (
        params: ICellRendererParams<PurchaseShipment, string>,
      ) => {
        if (!params.data?.tracking_url) {
          return params.value || "Sin código";
        }
        return (
          <Button
            component="a"
            href={params.data.tracking_url}
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            endIcon={<LaunchIcon />}
          >
            {params.value || "Abrir seguimiento"}
          </Button>
        );
      },
    },
    {
      field: "state",
      colId: "state",
      headerName: "Estado",
      width: 180,
      cellRenderer: (
        params: ICellRendererParams<PurchaseShipment, ShipmentStatus>,
      ) => {
        const status = params.value || "PREPARANDO";
        const color = shipmentStatusColor(status);
        return (
          <Stack
            sx={{
              height: "100%",
              justifyContent: "center",
              alignItems: "flex-start",
            }}
          >
            <Chip
              size="small"
              label={params.data?.state_display || status}
              sx={{ color, border: `1px solid ${color}`, fontWeight: 800 }}
            />
          </Stack>
        );
      },
    },
    {
      field: "current_custodian_display",
      colId: "current_custodian",
      headerName: "Gestión actual",
      minWidth: 205,
    },
    {
      field: "current_eta",
      colId: "current_eta",
      headerName: "Llegada estimada",
      width: 165,
      valueFormatter: (params) => String(params.value || "Sin fecha"),
    },
    {
      field: "days_remaining",
      colId: "days_remaining",
      headerName: "Plazo",
      width: 180,
      cellRenderer: (
        params: ICellRendererParams<PurchaseShipment, number | null>,
      ) => {
        const days = params.value ?? null;
        return (
          <Typography
            variant="body2"
            sx={{
              color: days !== null && days < 0
                ? colors.status.error
                : colors.text.primary,
              fontWeight: days !== null && days < 0 ? 800 : 600,
            }}
          >
            {remainingLabel(days)}
          </Typography>
        );
      },
    },
    {
      field: "customs_review_expected",
      colId: "customs_review_expected",
      headerName: "Aduanas",
      width: 135,
      cellRenderer: (
        params: ICellRendererParams<PurchaseShipment, boolean>,
      ) => (
        <Chip
          size="small"
          label={params.value ? "Revisar" : "Sin alerta"}
          color={params.value ? "warning" : "default"}
          variant={params.value ? "filled" : "outlined"}
        />
      ),
    },
    {
      field: "responsible_name",
      colId: "responsible__username",
      headerName: "Responsable",
      width: 160,
    },
    {
      colId: "actions",
      headerName: "Acciones",
      width: 120,
      sortable: false,
      filter: false,
      cellRenderer: (params: ICellRendererParams<PurchaseShipment>) =>
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
