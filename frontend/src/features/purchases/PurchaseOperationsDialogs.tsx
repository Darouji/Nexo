import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { CapabilityGate } from "../../components/CapabilityGate";
import type {
  PurchaseOrder,
  PurchaseReceipt,
  PurchaseReceiptHistory,
  SupplierPayload,
} from "../../services/purchasesService";
import { canRegisterShipmentForOrder, formatPurchaseStatus } from "./purchaseModels";

export type PurchaseTransition =
  | "submit-review"
  | "approve"
  | "issue"
  | "cancel"
  | "close";

export function SupplierDialog({
  open,
  loading,
  error,
  errors,
  values,
  onChange,
  onClose,
  onSave,
}: {
  open: boolean;
  loading: boolean;
  error: string;
  errors: Record<string, string>;
  values: SupplierPayload;
  onChange: (values: SupplierPayload) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const fields: Array<[keyof SupplierPayload, string]> = [
    ["tax_id", "RUT / Identificación tributaria"],
    ["name", "Razón social"],
    ["trade_name", "Nombre comercial"],
    ["country", "País"],
    ["contact_name", "Persona de contacto"],
    ["email", "Correo"],
    ["phone", "Teléfono"],
  ];

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>Nuevo proveedor</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {fields.map(([field, label]) => (
            <TextField
              key={field}
              label={label}
              value={String(values[field] ?? "")}
              onChange={(event) => onChange({ ...values, [field]: event.target.value })}
              error={Boolean(errors[field])}
              helperText={errors[field]}
            />
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button variant="contained" onClick={onSave} disabled={loading}>
          {loading ? "Guardando..." : "Guardar proveedor"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function OrderDetailDialog({
  order,
  loading,
  onClose,
  onTransition,
  onRegisterShipment,
  onEdit,
}: {
  order: PurchaseOrder | null;
  loading: boolean;
  onClose: () => void;
  onTransition: (action: PurchaseTransition) => void;
  onRegisterShipment: (order: PurchaseOrder) => void;
  onEdit: (order: PurchaseOrder) => void;
}) {
  if (!order) return null;

  return (
    <Dialog open fullWidth maxWidth="md" onClose={loading ? undefined : onClose}>
      <DialogTitle>{order.number} · {order.supplier_name}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="info">
            Estado actual: <strong>{formatPurchaseStatus(order.status)}</strong>.
            Emitir crea compromisos por recibir; no aumenta stock ni genera Kardex.
          </Alert>
          <Typography>
            <strong>Fecha:</strong> {order.issue_date} · <strong>Moneda:</strong>{" "}
            {order.currency}
          </Typography>
          <Typography>
            <strong>Monto neto:</strong>{" "}
            {Number(order.supplier_amount).toLocaleString("es-CL")} ·{" "}
            <strong>IVA (19%):</strong>{" "}
            {Number(order.tax_amount).toLocaleString("es-CL")} ·{" "}
            <strong>Total con IVA:</strong>{" "}
            {Number(order.total_original).toLocaleString("es-CL")}
            {order.currency === "USD" ? (
              <> · <strong>Equivalente CLP:</strong>{" "}{Number(order.total_clp).toLocaleString("es-CL")}</>
            ) : null}
          </Typography>
          <Stack spacing={0.75}>
            <Typography sx={{ fontWeight: 900 }}>Líneas de la orden</Typography>
            {order.lines.map((line, index) => (
              <Typography key={line.id ?? index} variant="body2">
                {index + 1}. {line.description} · {line.quantity} unidad(es) ·{" "}
                {line.inventory_managed ? "Con recepción física" : "Sin control de stock"}
              </Typography>
            ))}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap" }}>
        <Button onClick={onClose} disabled={loading}>Cerrar</Button>
        {canRegisterShipmentForOrder(order.status) ? (
          <CapabilityGate capability="purchases.create_shipment">
            <Button
              startIcon={<LocalShippingIcon />}
              onClick={() => onRegisterShipment(order)}
            >
              Registrar envío
            </Button>
          </CapabilityGate>
        ) : null}
        {order.status === "BORRADOR" ? (
          <>
            <CapabilityGate capability="purchases.edit_draft"><Button onClick={() => onEdit(order)}>Editar borrador</Button></CapabilityGate>
            <CapabilityGate capability="purchases.submit_review"><Button onClick={() => onTransition("submit-review")}>Enviar a revisión</Button></CapabilityGate>
          </>
        ) : null}
        {order.status === "EN_REVISION" ? (
          <CapabilityGate capability="purchases.approve_order"><Button onClick={() => onTransition("approve")}>Aprobar</Button></CapabilityGate>
        ) : null}
        {order.status === "APROBADA" ? (
          <CapabilityGate capability="purchases.issue_order"><Button variant="contained" onClick={() => onTransition("issue")}>Emitir</Button></CapabilityGate>
        ) : null}
        {(order.status === "RECIBIDA" || (["EMITIDA", "PARCIALMENTE_RECIBIDA"].includes(order.status) && order.pending_units_total === 0)) ? (
          <CapabilityGate capability="purchases.close_order"><Button variant="contained" onClick={() => onTransition("close")}>Cerrar orden</Button></CapabilityGate>
        ) : null}
        {(["EMITIDA", "PARCIALMENTE_RECIBIDA"].includes(order.status) && order.pending_units_total > 0) ? (
          <CapabilityGate capability="purchases.cancel_order"><Button color="error" onClick={() => onTransition("cancel")}>Cancelar remanentes</Button></CapabilityGate>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}

export function TransitionReasonDialog({
  open,
  actionLabel,
  reason,
  error,
  loading,
  onReasonChange,
  onClose,
  onConfirm,
}: {
  open: boolean;
  actionLabel: string;
  reason: string;
  error: string;
  loading: boolean;
  onReasonChange: (reason: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{actionLabel}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField
            label="Motivo"
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            helperText="Quedará registrado en la trazabilidad de la orden."
            multiline
            minRows={3}
            autoFocus
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button variant="contained" onClick={onConfirm} disabled={loading || !reason.trim()}>
          {loading ? "Procesando..." : "Confirmar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function ReceiveCommitmentDialog({
  commitment,
  mode,
  quantity,
  reason,
  error,
  loading,
  onQuantityChange,
  onReasonChange,
  onClose,
  onConfirm,
}: {
  commitment: PurchaseReceipt | null;
  mode: "RECEIVE" | "CANCEL";
  quantity: string;
  reason: string;
  error: string;
  loading: boolean;
  onQuantityChange: (quantity: string) => void;
  onReasonChange: (reason: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!commitment) return null;
  const receiving = mode === "RECEIVE";
  return (
    <Dialog open fullWidth maxWidth="sm" onClose={loading ? undefined : onClose}>
      <DialogTitle>{receiving ? "Registrar recepción física" : "Cancelar unidades pendientes"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity={receiving ? "warning" : "info"}>
            {receiving
              ? "Esta acción incrementará stock y generará Kardex."
              : "Esta acción cerrará unidades pendientes sin modificar stock ni generar Kardex."}{" "}
            Pendiente: <strong>{commitment.pending_units}</strong>.
          </Alert>
          <Typography sx={{ fontWeight: 800 }}>
            {commitment.product_model} · {commitment.origin_display}
            {commitment.order_number ? ` · ${commitment.order_number}` : ""}
          </Typography>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField
            label={receiving ? "Cantidad recibida" : "Cantidad a cancelar"}
            type="number"
            value={quantity}
            onChange={(event) => onQuantityChange(event.target.value)}
            slotProps={{ htmlInput: { min: 1, max: commitment.pending_units } }}
            error={Boolean(quantity) && (
              Number(quantity) < 1 || Number(quantity) > commitment.pending_units
            )}
            helperText={`Máximo permitido: ${commitment.pending_units}`}
          />
          <TextField
            label="Motivo / respaldo"
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            error={!reason.trim() && Boolean(quantity)}
            helperText="Obligatorio; quedará registrado en la trazabilidad."
            multiline
            minRows={3}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Volver</Button>
        <Button
          variant="contained"
          color={receiving ? "primary" : "error"}
          onClick={onConfirm}
          disabled={
            loading || !reason.trim() || Number(quantity) < 1 ||
            Number(quantity) > commitment.pending_units
          }
        >
          {loading ? "Procesando..." : receiving ? "Confirmar recepción" : "Confirmar cancelación"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function PhysicalReceiptHistoryDialog({
  receipt,
  operations,
  loading,
  error,
  onClose,
}: {
  receipt: PurchaseReceipt | null;
  operations: PurchaseReceiptHistory[];
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(receipt)} fullWidth maxWidth="md" onClose={onClose}>
      <DialogTitle>Historial de recepción física</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {receipt ? (
            <Alert severity="info">
              {receipt.product_model} · SAP {receipt.product_sap || "sin código"} · {receipt.product_category}
              {receipt.order_number ? ` · Orden ${receipt.order_number}` : " · Registro manual"}
            </Alert>
          ) : null}
          {loading ? <Typography>Cargando historial...</Typography> : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
          {!loading && !error && operations.length === 0 ? (
            <Alert severity="info">Esta recepción todavía no tiene operaciones.</Alert>
          ) : null}
          {operations.map((operation) => (
            <Stack key={operation.id} spacing={0.5} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
              <Typography sx={{ fontWeight: 900 }}>
                {operation.responsible_name} {operation.operation_type === "RECEIVE" ? "recibió" : "canceló"} {operation.quantity} unidades
              </Typography>
              <Typography color="text.secondary">
                Pendiente: {operation.pending_before} → {operation.pending_after}. Estado: {operation.previous_state_display} → {operation.new_state_display}.
              </Typography>
              <Typography>Motivo: {operation.reason}</Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(operation.occurred_at).toLocaleString("es-CL")}
                {operation.kardex_movement ? ` · Kardex N.º ${operation.kardex_movement}` : ""}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cerrar</Button></DialogActions>
    </Dialog>
  );
}
