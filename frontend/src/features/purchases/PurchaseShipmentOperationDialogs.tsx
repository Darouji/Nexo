import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  SHIPMENT_CHARGE_OPTIONS,
  SHIPMENT_CHARGE_STATUS_OPTIONS,
  SHIPMENT_CUSTODIAN_OPTIONS,
  SHIPMENT_EVENT_OPTIONS,
  SHIPMENT_STATUS_OPTIONS,
  type ShipmentChargeForm,
  type ShipmentEventForm,
} from "./purchaseLogisticsModels";

type EventDialogProps = {
  open: boolean;
  form: ShipmentEventForm;
  errors: Record<string, string>;
  generalError: string;
  loading: boolean;
  onChange: (form: ShipmentEventForm) => void;
  onClose: () => void;
  onSave: () => void;
};

export function PurchaseShipmentEventDialog({
  open,
  form,
  errors,
  generalError,
  loading,
  onChange,
  onClose,
  onSave,
}: EventDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Registrar novedad del pedido</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {generalError ? <Alert severity="error">{generalError}</Alert> : null}
          <Alert severity="info">
            Esta novedad quedará en el historial y no podrá editarse ni eliminarse.
            Corrige un error mediante un nuevo evento aclaratorio.
          </Alert>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: 2,
            }}
          >
            <TextField
              select
              label="Tipo de novedad"
              value={form.eventType}
              onChange={(event) =>
                onChange({ ...form, eventType: event.target.value })
              }
            >
              {SHIPMENT_EVENT_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              type="datetime-local"
              label="Fecha y hora"
              value={form.occurredAt}
              onChange={(event) =>
                onChange({ ...form, occurredAt: event.target.value })
              }
              error={Boolean(errors.occurred_at)}
              helperText={errors.occurred_at}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Qué ocurrió"
              value={form.title}
              onChange={(event) =>
                onChange({ ...form, title: event.target.value })
              }
              error={Boolean(errors.title)}
              helperText={errors.title}
              sx={{ gridColumn: { md: "1 / -1" } }}
            />
            <TextField
              select
              label="Nuevo estado (opcional)"
              value={form.newState}
              onChange={(event) =>
                onChange({
                  ...form,
                  newState: event.target.value as ShipmentEventForm["newState"],
                })
              }
            >
              <MenuItem value="">Sin cambio de estado</MenuItem>
              {SHIPMENT_STATUS_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Quién lo gestiona ahora (opcional)"
              value={form.newCustodian}
              onChange={(event) =>
                onChange({
                  ...form,
                  newCustodian: event.target
                    .value as ShipmentEventForm["newCustodian"],
                })
              }
            >
              <MenuItem value="">Sin cambio de responsable externo</MenuItem>
              {SHIPMENT_CUSTODIAN_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              type="date"
              label="Nueva fecha estimada (opcional)"
              value={form.updatedEta}
              onChange={(event) =>
                onChange({ ...form, updatedEta: event.target.value })
              }
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Referencia o evidencia"
              value={form.evidenceReference}
              onChange={(event) =>
                onChange({ ...form, evidenceReference: event.target.value })
              }
              helperText="Ejemplo: correo del courier, liquidación o número de caso."
            />
          </Box>
          <TextField
            label="Explicación"
            value={form.description}
            onChange={(event) =>
              onChange({ ...form, description: event.target.value })
            }
            multiline
            minRows={3}
            helperText="Escribe una explicación que cualquier trabajador pueda comprender."
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={onSave} disabled={loading}>
          {loading ? "Guardando..." : "Guardar novedad"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

type ChargeDialogProps = {
  open: boolean;
  form: ShipmentChargeForm;
  errors: Record<string, string>;
  generalError: string;
  loading: boolean;
  onChange: (form: ShipmentChargeForm) => void;
  onClose: () => void;
  onSave: () => void;
};

export function PurchaseShipmentChargeDialog({
  open,
  form,
  errors,
  generalError,
  loading,
  onChange,
  onClose,
  onSave,
}: ChargeDialogProps) {
  const foreignCurrency = form.currency.trim().toUpperCase() !== "CLP";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Registrar cobro adicional</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {generalError ? <Alert severity="error">{generalError}</Alert> : null}
          <Typography variant="body2" color="text.secondary">
            Registra sólo cobros relacionados con este envío. Los datos de
            conversión aparecen únicamente cuando la moneda no es CLP.
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: 2,
            }}
          >
            <TextField
              select
              label="Tipo de cobro"
              value={form.chargeType}
              onChange={(event) =>
                onChange({ ...form, chargeType: event.target.value })
              }
            >
              {SHIPMENT_CHARGE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Estado del cobro"
              value={form.chargeStatus}
              onChange={(event) =>
                onChange({ ...form, chargeStatus: event.target.value })
              }
            >
              {SHIPMENT_CHARGE_STATUS_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Descripción"
              value={form.description}
              onChange={(event) =>
                onChange({ ...form, description: event.target.value })
              }
              error={Boolean(errors.description)}
              helperText={errors.description}
              sx={{ gridColumn: { md: "1 / -1" } }}
            />
            <TextField
              type="number"
              label="Monto original"
              value={form.amountOriginal}
              onChange={(event) =>
                onChange({ ...form, amountOriginal: event.target.value })
              }
              error={Boolean(errors.amount_original)}
              helperText={errors.amount_original}
            />
            <TextField
              label="Moneda"
              value={form.currency}
              onChange={(event) =>
                onChange({
                  ...form,
                  currency: event.target.value.toUpperCase().slice(0, 3),
                })
              }
              error={Boolean(errors.currency)}
              helperText={errors.currency || "Ejemplo: CLP, USD o EUR."}
            />
            {foreignCurrency ? (
              <>
                <TextField
                  type="number"
                  label="Tipo de cambio a CLP"
                  value={form.exchangeRate}
                  onChange={(event) =>
                    onChange({ ...form, exchangeRate: event.target.value })
                  }
                  error={Boolean(errors.exchange_rate)}
                  helperText={errors.exchange_rate}
                />
                <TextField
                  type="date"
                  label="Fecha del tipo de cambio"
                  value={form.exchangeRateDate}
                  onChange={(event) =>
                    onChange({
                      ...form,
                      exchangeRateDate: event.target.value,
                    })
                  }
                  error={Boolean(errors.exchange_rate_date)}
                  helperText={errors.exchange_rate_date}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  label="Fuente del tipo de cambio"
                  value={form.exchangeRateSource}
                  onChange={(event) =>
                    onChange({
                      ...form,
                      exchangeRateSource: event.target.value,
                    })
                  }
                  error={Boolean(errors.exchange_rate_source)}
                  helperText={
                    errors.exchange_rate_source ||
                    "Ejemplo: Banco Central, factura o liquidación."
                  }
                  sx={{ gridColumn: { md: "1 / -1" } }}
                />
              </>
            ) : null}
            <TextField
              label="Cobrado por"
              value={form.chargedBy}
              onChange={(event) =>
                onChange({ ...form, chargedBy: event.target.value })
              }
              helperText="Courier, Aduanas, agencia u otra entidad."
            />
            <TextField
              label="Documento de respaldo"
              value={form.sourceReference}
              onChange={(event) =>
                onChange({ ...form, sourceReference: event.target.value })
              }
              helperText="Factura, liquidación, correo o número de caso."
            />
          </Box>
          <TextField
            label="Motivo"
            value={form.reason}
            onChange={(event) =>
              onChange({ ...form, reason: event.target.value })
            }
            error={Boolean(errors.reason)}
            helperText={
              errors.reason ||
              "Explica por qué se originó este cobro para conservar la trazabilidad."
            }
            multiline
            minRows={3}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={onSave} disabled={loading}>
          {loading ? "Guardando..." : "Registrar cobro"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
