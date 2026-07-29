import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import AddCardIcon from "@mui/icons-material/AddCard";
import LaunchIcon from "@mui/icons-material/Launch";
import TimelineIcon from "@mui/icons-material/Timeline";

import { CapabilityGate } from "../../components/CapabilityGate";
import type { PurchaseShipment } from "../../services/purchasesLogisticsService";
import { colors } from "../../theme/colors";

type Props = {
  shipment: PurchaseShipment | null;
  onClose: () => void;
  onAddEvent: () => void;
  onAddCharge: () => void;
};

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

function readableDate(value: string | null | undefined, withTime = false) {
  if (!value) return "Sin información";
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value,
  );
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" as const } : {}),
  }).format(date);
}

function InfoValue({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <Stack spacing={0.25}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {value}
      </Typography>
    </Stack>
  );
}

export function PurchaseShipmentDetailDialog({
  shipment,
  onClose,
  onAddEvent,
  onAddCharge,
}: Props) {
  return (
    <Dialog
      open={Boolean(shipment)}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
    >
      <DialogTitle>Seguimiento del envío</DialogTitle>
      <DialogContent>
        {shipment ? (
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1}
              sx={{ justifyContent: "space-between", alignItems: { md: "center" } }}
            >
              <Stack>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  {shipment.order_number} · {shipment.carrier_name}
                </Typography>
                <Typography color="text.secondary">
                  {shipment.supplier_name}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                <Chip label={shipment.state_display} color="primary" />
                <Chip
                  label={`Gestión: ${shipment.current_custodian_display}`}
                  variant="outlined"
                />
                {shipment.customs_review_expected ? (
                  <Chip label="Requiere atención aduanera" color="warning" />
                ) : null}
              </Stack>
            </Stack>

            {shipment.customs_review_expected ? (
              <Alert severity="warning">
                <strong>Atención aduanera:</strong>{" "}
                {shipment.customs_review_reason ||
                  "Confirmar antecedentes con el courier o agente de aduanas."}
              </Alert>
            ) : null}

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, 1fr)",
                  md: "repeat(4, 1fr)",
                },
                gap: 2,
                p: 2,
                border: `1px solid ${colors.border.light}`,
                borderRadius: 2,
              }}
            >
              <InfoValue
                label="Código de seguimiento"
                value={shipment.tracking_number || "Sin código"}
              />
              <InfoValue
                label="Medio de transporte"
                value={shipment.transport_mode_display}
              />
              <InfoValue
                label="Estimación inicial"
                value={readableDate(shipment.initial_eta)}
              />
              <InfoValue
                label="Estimación actual"
                value={readableDate(shipment.effective_eta)}
              />
              <InfoValue
                label="Origen"
                value={
                  [shipment.origin_place, shipment.origin_country]
                    .filter(Boolean)
                    .join(", ") || "Sin información"
                }
              />
              <InfoValue label="Destino" value={shipment.destination_place} />
              <InfoValue
                label="Responsable"
                value={shipment.responsible_name}
              />
              <InfoValue
                label="Cobros confirmados"
                value={clp.format(Number(shipment.confirmed_charges_clp || 0))}
              />
            </Box>

            {shipment.tracking_url ? (
              <Link
                href={shipment.tracking_url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ alignSelf: "flex-start", fontWeight: 800 }}
              >
                Abrir seguimiento oficial <LaunchIcon fontSize="inherit" />
              </Link>
            ) : null}

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
            >
              <Stack>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  Historial del pedido
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Registro cronológico e inmutable de avances e incidencias.
                </Typography>
              </Stack>
              <CapabilityGate capability="purchases.update_shipment">
                <Button
                  variant="contained"
                  startIcon={<TimelineIcon />}
                  onClick={onAddEvent}
                >
                  Registrar novedad
                </Button>
              </CapabilityGate>
            </Stack>

            {shipment.events.length ? (
              <Stack spacing={1.25}>
                {shipment.events.map((event) => (
                  <Box
                    key={event.id}
                    sx={{
                      p: 1.75,
                      borderLeft: `4px solid ${colors.modules.purchases}`,
                      bgcolor: colors.background.subtle,
                      borderRadius: 1.5,
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      sx={{ justifyContent: "space-between" }}
                    >
                      <Typography sx={{ fontWeight: 900 }}>{event.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {readableDate(event.occurred_at, true)} ·{" "}
                        {event.responsible_name}
                      </Typography>
                    </Stack>
                    {event.description ? (
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {event.description}
                      </Typography>
                    ) : null}
                    <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                      {event.new_state ? (
                        <Chip
                          size="small"
                          label={`Estado: ${event.new_state_display}`}
                        />
                      ) : null}
                      {event.new_custodian ? (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`Gestión: ${event.new_custodian_display}`}
                        />
                      ) : null}
                      {event.updated_eta ? (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`Nueva llegada: ${readableDate(event.updated_eta)}`}
                        />
                      ) : null}
                    </Stack>
                    {event.evidence_reference ? (
                      <Typography variant="caption" color="text.secondary">
                        Respaldo: {event.evidence_reference}
                      </Typography>
                    ) : null}
                  </Box>
                ))}
              </Stack>
            ) : (
              <Alert severity="info">Todavía no existen novedades registradas.</Alert>
            )}

            <Divider />

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
            >
              <Stack>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  Cobros adicionales
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Flete, aduanas, seguros, demoras y otros costos con respaldo.
                </Typography>
              </Stack>
              <CapabilityGate capability="purchases.manage_shipment_costs">
                <Button
                  variant="outlined"
                  startIcon={<AddCardIcon />}
                  onClick={onAddCharge}
                >
                  Registrar cobro
                </Button>
              </CapabilityGate>
            </Stack>

            {shipment.charges.length ? (
              <Stack spacing={1}>
                {shipment.charges.map((charge) => (
                  <Box
                    key={charge.id}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        md: "2fr 1fr 1fr 1fr",
                      },
                      gap: 1.5,
                      p: 1.5,
                      border: `1px solid ${colors.border.light}`,
                      borderRadius: 1.5,
                    }}
                  >
                    <InfoValue
                      label={charge.charge_type_display}
                      value={charge.description}
                    />
                    <InfoValue
                      label="Monto original"
                      value={`${charge.currency} ${charge.amount_original}`}
                    />
                    <InfoValue
                      label="Equivalente CLP"
                      value={clp.format(Number(charge.amount_clp || 0))}
                    />
                    <InfoValue
                      label="Estado"
                      value={charge.charge_status_display}
                    />
                    <Box sx={{ gridColumn: { md: "1 / -1" } }}>
                      <Typography variant="caption" color="text.secondary">
                        Motivo: {charge.reason}
                        {charge.source_reference
                          ? ` · Respaldo: ${charge.source_reference}`
                          : ""}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Alert severity="info">
                No hay cobros adicionales asociados a este envío.
              </Alert>
            )}
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
