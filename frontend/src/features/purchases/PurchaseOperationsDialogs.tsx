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
  SupplierPayload,
} from "../../services/purchasesService";
import { formatPurchaseStatus } from "./purchaseModels";

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
}: {
  order: PurchaseOrder | null;
  loading: boolean;
  onClose: () => void;
  onTransition: (action: PurchaseTransition) => void;
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
            {order.currency} · <strong>Total CLP:</strong>{" "}
            {Number(order.total_clp).toLocaleString("es-CL")}
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
        {order.status === "BORRADOR" ? (
          <CapabilityGate capability="purchases.submit_review"><Button onClick={() => onTransition("submit-review")}>Enviar a revisión</Button></CapabilityGate>
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
  return (
    <Dialog open fullWidth maxWidth="sm" onClose={loading ? undefined : onClose}>
      <DialogTitle>Registrar recepción física</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="warning">
            Esta acción sí incrementará stock y generará Kardex. Pendiente:{" "}
            <strong>{commitment.pending_units}</strong>.
          </Alert>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField
            label="Cantidad recibida"
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
            label="Motivo / respaldo de recepción"
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            error={!reason.trim() && Boolean(quantity)}
            helperText="Obligatorio; quedará en auditoría y Kardex."
            multiline
            minRows={3}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={
            loading ||
            !reason.trim() ||
            Number(quantity) < 1 ||
            Number(quantity) > commitment.pending_units
          }
        >
          {loading ? "Registrando..." : "Confirmar recepción"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
