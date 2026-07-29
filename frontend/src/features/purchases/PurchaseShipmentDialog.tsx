import { useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import type { PurchaseOrder } from "../../services/purchasesService";
import type { Carrier } from "../../services/purchasesLogisticsService";
import {
  SHIPMENT_CUSTODIAN_OPTIONS,
  SHIPMENT_MODE_OPTIONS,
  SHIPMENT_STATUS_OPTIONS,
  type ShipmentForm,
} from "./purchaseLogisticsModels";

type Props = {
  open: boolean;
  form: ShipmentForm;
  orders: PurchaseOrder[];
  carrierOptions: Carrier[];
  errors: Record<string, string>;
  generalError: string;
  loading: boolean;
  carrierLoading: boolean;
  onChange: (form: ShipmentForm) => void;
  onCarrierSearch: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
};

export function PurchaseShipmentDialog({
  open,
  form,
  orders,
  carrierOptions,
  errors,
  generalError,
  loading,
  carrierLoading,
  onChange,
  onCarrierSearch,
  onClose,
  onSave,
}: Props) {
  const [showGuidance, setShowGuidance] = useState(true);

  const selectedCarrier =
    carrierOptions.find((carrier) => String(carrier.id) === form.carrierId) ??
    null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Registrar envío o importación</DialogTitle>
      <DialogContent>
        <Stack spacing={2.2} sx={{ pt: 1 }}>
          {showGuidance ? (
            <Alert severity="info" onClose={() => setShowGuidance(false)}>
              Este seguimiento no aumenta el stock. La existencia y el Kardex
              cambian únicamente cuando se registra la recepción física.
            </Alert>
          ) : null}
          {generalError ? <Alert severity="error">{generalError}</Alert> : null}

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: 2,
            }}
          >
            <TextField
              select
              label="Orden de compra"
              value={form.order}
              onChange={(event) =>
                onChange({ ...form, order: event.target.value })
              }
              error={Boolean(errors.order)}
              helperText={
                errors.order ||
                "Sólo se muestran órdenes aprobadas, emitidas o parcialmente recibidas."
              }
            >
              {orders.map((order) => (
                <MenuItem key={order.id} value={order.id}>
                  {order.number} · {order.supplier_name}
                </MenuItem>
              ))}
            </TextField>

            <Autocomplete
              freeSolo
              loading={carrierLoading}
              options={carrierOptions}
              value={selectedCarrier}
              inputValue={form.carrierName}
              getOptionLabel={(option) =>
                typeof option === "string" ? option : option.name
              }
              isOptionEqualToValue={(option, value) =>
                typeof option !== "string" &&
                typeof value !== "string" &&
                option.id === value.id
              }
              onInputChange={(_event, value, reason) => {
                if (reason === "input" || reason === "clear") {
                  onChange({
                    ...form,
                    carrierId: "",
                    carrierName: value,
                  });
                  onCarrierSearch(value);
                }
              }}
              onChange={(_event, value) => {
                if (typeof value === "string") {
                  onChange({
                    ...form,
                    carrierId: "",
                    carrierName: value,
                  });
                  return;
                }
                onChange({
                  ...form,
                  carrierId: value ? String(value.id) : "",
                  carrierName: value?.name ?? "",
                });
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Empresa transportista"
                  error={Boolean(errors.carrier)}
                  helperText={
                    errors.carrier ||
                    "Selecciona una sugerencia o escribe un nombre nuevo."
                  }
                />
              )}
            />

            <TextField
              select
              label="Medio de transporte"
              value={form.transportMode}
              onChange={(event) =>
                onChange({
                  ...form,
                  transportMode: event.target
                    .value as ShipmentForm["transportMode"],
                })
              }
            >
              {SHIPMENT_MODE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Código de seguimiento"
              value={form.trackingNumber}
              onChange={(event) =>
                onChange({ ...form, trackingNumber: event.target.value })
              }
              helperText="Puedes incorporarlo después mediante un evento si aún no existe."
            />

            <TextField
              label="País de origen"
              value={form.originCountry}
              onChange={(event) =>
                onChange({ ...form, originCountry: event.target.value })
              }
            />
            <TextField
              label="Lugar de origen"
              value={form.originPlace}
              onChange={(event) =>
                onChange({ ...form, originPlace: event.target.value })
              }
            />
            <TextField
              label="Destino"
              value={form.destinationPlace}
              onChange={(event) =>
                onChange({ ...form, destinationPlace: event.target.value })
              }
              error={Boolean(errors.destination_place)}
              helperText={errors.destination_place}
            />
            <TextField
              type="date"
              label="Fecha de despacho"
              value={form.shippedDate}
              onChange={(event) =>
                onChange({ ...form, shippedDate: event.target.value })
              }
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              type="date"
              label="Estimación inicial de llegada"
              value={form.initialEta}
              onChange={(event) =>
                onChange({ ...form, initialEta: event.target.value })
              }
              error={Boolean(errors.initial_eta)}
              helperText={errors.initial_eta}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              type="date"
              label="Estimación actual"
              value={form.currentEta}
              onChange={(event) =>
                onChange({ ...form, currentEta: event.target.value })
              }
              error={Boolean(errors.current_eta)}
              helperText={
                errors.current_eta ||
                "Déjala vacía si todavía coincide con la estimación inicial."
              }
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              select
              label="Estado inicial"
              value={form.state}
              onChange={(event) =>
                onChange({
                  ...form,
                  state: event.target.value as ShipmentForm["state"],
                })
              }
            >
              {SHIPMENT_STATUS_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Quién gestiona actualmente"
              value={form.currentCustodian}
              onChange={(event) =>
                onChange({
                  ...form,
                  currentCustodian: event.target
                    .value as ShipmentForm["currentCustodian"],
                })
              }
            >
              {SHIPMENT_CUSTODIAN_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Accordion disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack>
                <Typography sx={{ fontWeight: 800 }}>
                  Gestión aduanera especial
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Sólo complétala cuando corresponda. El sistema también genera
                  una alerta interna para órdenes USD sobre el umbral configurado.
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={form.customsReviewExpected}
                      onChange={(event) =>
                        onChange({
                          ...form,
                          customsReviewExpected: event.target.checked,
                          customsReviewReason: event.target.checked
                            ? form.customsReviewReason
                            : "",
                        })
                      }
                    />
                  }
                  label="Se espera una gestión aduanera especial"
                />
                {form.customsReviewExpected ? (
                  <TextField
                    label="Motivo o antecedente conocido"
                    value={form.customsReviewReason}
                    onChange={(event) =>
                      onChange({
                        ...form,
                        customsReviewReason: event.target.value,
                      })
                    }
                    error={Boolean(errors.customs_review_reason)}
                    helperText={errors.customs_review_reason}
                    multiline
                    minRows={2}
                  />
                ) : null}
              </Stack>
            </AccordionDetails>
          </Accordion>

          <TextField
            label="Observaciones"
            value={form.notes}
            onChange={(event) =>
              onChange({ ...form, notes: event.target.value })
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
          {loading ? "Guardando..." : "Registrar seguimiento"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
