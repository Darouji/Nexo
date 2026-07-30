import AddLocationAltIcon from "@mui/icons-material/AddLocationAlt";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import { SectionCard } from "../../../components/SectionCard";
import { colors } from "../../../theme/colors";
import { formatNumber } from "../utils/inventoryFormatters";
import {
  emptyArchiveLocation,
  useInventoryLocationsController,
} from "./useInventoryLocationsController";

const locationTypes = [
  { value: "BODEGA", label: "Bodega" },
  {
    value: "DOMICILIO_CUSTODIA",
    label: "Domicilio bajo custodia",
  },
  { value: "TRANSITO", label: "Tránsito" },
  { value: "CLIENTE_FAENA", label: "Cliente o faena" },
  { value: "OTRO", label: "Otra ubicación" },
] as const;

type InventoryLocationsSectionProps = {
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  onInventoryChanged?: () => void | Promise<void>;
  onLocationsChanged?: () => void | Promise<void>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function InventoryLocationsSection({
  onError,
  onSuccess,
  onInventoryChanged,
  onLocationsChanged,
}: InventoryLocationsSectionProps) {
  const controller = useInventoryLocationsController({
    onError,
    onSuccess,
    onInventoryChanged,
    onLocationsChanged,
  });

  const {
    locations,
    activeLocations,
    balances,
    balanceCount,
    balancePage,
    balancePageSize,
    changeBalancePagination,
    transfers,
    collaborators,
    originBalances,
    loading,
    saving,
    canManageLocations,
    canTransferStock,
    locationForm,
    setLocationForm,
    transferForm,
    setTransferForm,
    transferErrorMessage,
    transferFieldErrors,
    clearTransferFieldError,
    archiveState,
    setArchiveState,
    loadData,
    openCreateLocation,
    openEditLocation,
    closeLocationForm,
    saveLocation,
    requestArchiveLocation,
    archiveLocation,
    openTransfer,
    closeTransfer,
    saveTransfer,
  } = controller;

  const selectedOriginBalance = originBalances.find(
    (balance) => balance.location === Number(transferForm.originLocation),
  );
  const selectedOrigin = activeLocations.find(
    (location) => location.id === Number(transferForm.originLocation),
  );
  const selectedDestination = activeLocations.find(
    (location) => location.id === Number(transferForm.destinationLocation),
  );
  const sensitiveTransfer = [
    selectedOrigin?.location_type,
    selectedDestination?.location_type,
  ].some(
    (type) =>
      type === "DOMICILIO_CUSTODIA" || type === "CLIENTE_FAENA",
  );
  const transferQuantity = Number(transferForm.quantity);
  const transferIsValid =
    Boolean(transferForm.product) &&
    Boolean(transferForm.originLocation) &&
    Boolean(transferForm.destinationLocation) &&
    transferForm.originLocation !== transferForm.destinationLocation &&
    transferQuantity > 0 &&
    transferQuantity <= (selectedOriginBalance?.quantity || 0) &&
    Boolean(transferForm.reason.trim()) &&
    (!sensitiveTransfer || Boolean(transferForm.evidenceReference.trim()));

  const locationFormIsValid =
    Boolean(locationForm.name.trim()) &&
    (locationForm.locationType !== "DOMICILIO_CUSTODIA" ||
      Boolean(locationForm.custodian));

  return (
    <>
      <SectionCard
        title="Ubicaciones y custodia"
        subtitle="Distribución física del stock, responsables de custodia y traslados inmutables entre ubicaciones."
        actions={
          <>
            <Button
              size="small"
              startIcon={<RefreshIcon />}
              onClick={() => void loadData()}
              disabled={loading}
            >
              Actualizar
            </Button>
            {canManageLocations ? (
              <Button
                size="small"
                variant="contained"
                startIcon={<AddLocationAltIcon />}
                onClick={openCreateLocation}
              >
                Nueva ubicación
              </Button>
            ) : null}
          </>
        }
      >
        {loading ? <LinearProgress sx={{ mb: 2 }} /> : null}

        <Stack spacing={3}>
          <Stack spacing={0.35}>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              Ubicaciones registradas
            </Typography>
            <Typography variant="body2" sx={{ color: colors.text.secondary }}>
              Bodegas, custodias y otros lugares habilitados para mantener inventario.
            </Typography>
          </Stack>

          <TableContainer
            sx={{
              border: `1px solid ${colors.border.light}`,
              borderLeft: `4px solid ${colors.modules.inventory.main}`,
              borderRadius: colors.radius.lg,
            }}
          >
            <Table size="small" aria-label="Ubicaciones de inventario">
              <TableHead>
                <TableRow>
                  <TableCell>Ubicación</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Custodio / referencia</TableCell>
                  <TableCell align="right">Unidades</TableCell>
                  <TableCell>Estado</TableCell>
                  {canManageLocations ? (
                    <TableCell align="right">Acciones</TableCell>
                  ) : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {locations.map((location) => (
                  <TableRow key={location.id} hover>
                    <TableCell>
                      <Stack spacing={0.25}>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                          {location.name}
                        </Typography>
                        {location.city ? (
                          <Typography variant="caption" color="text.secondary">
                            {location.city}
                          </Typography>
                        ) : null}
                      </Stack>
                    </TableCell>
                    <TableCell>{location.location_type_display}</TableCell>
                    <TableCell>
                      {location.custodian_name ||
                        location.description ||
                        "Sin referencia adicional"}
                    </TableCell>
                    <TableCell align="right">
                      {formatNumber(location.total_units)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={
                          location.status === "ACTIVO"
                            ? "success"
                            : "default"
                        }
                        label={
                          location.is_regularization
                            ? "Regularización histórica"
                            : location.status === "ACTIVO"
                              ? "Activa"
                              : "Archivada"
                        }
                        variant="outlined"
                      />
                    </TableCell>
                    {canManageLocations ? (
                      <TableCell align="right">
                        <Tooltip title="Editar ubicación">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => openEditLocation(location)}
                              disabled={location.status !== "ACTIVO"}
                            >
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        {!location.is_regularization ? (
                          <Tooltip title="Archivar ubicación">
                            <span>
                              <IconButton
                                size="small"
                                onClick={() =>
                                  requestArchiveLocation(location)
                                }
                                disabled={location.status !== "ACTIVO"}
                              >
                                <ArchiveOutlinedIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
                {!loading && locations.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={canManageLocations ? 6 : 5}
                      align="center"
                    >
                      No hay ubicaciones registradas.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>

          <Stack
            spacing={1}
            sx={{
              p: 2,
              border: `1px solid ${colors.border.light}`,
              borderLeft: `4px solid ${colors.status.info}`,
              borderRadius: colors.radius.lg,
              bgcolor: colors.surface.soft,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 850 }}>
              Stock distribuido
            </Typography>
            <Typography variant="body2" sx={{ color: colors.text.secondary }}>
              Existencias físicas de cada producto, separadas por ubicación.
            </Typography>
            <TableContainer sx={{ maxHeight: 320 }}>
              <Table size="small" stickyHeader aria-label="Stock por ubicación">
                <TableHead>
                  <TableRow>
                    <TableCell>Producto</TableCell>
                    <TableCell>Código SAP</TableCell>
                    <TableCell>Categoría</TableCell>
                    <TableCell>Ubicación</TableCell>
                    <TableCell align="right">Cantidad</TableCell>
                    {canTransferStock ? (
                      <TableCell align="right">Acción</TableCell>
                    ) : null}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {balances.map((balance) => (
                    <TableRow key={balance.id} hover>
                      <TableCell>{balance.product_model}</TableCell>
                      <TableCell>{balance.product_sap_code || "Sin SAP"}</TableCell>
                      <TableCell>{balance.product_category}</TableCell>
                      <TableCell>{balance.location_name}</TableCell>
                      <TableCell align="right">
                        {formatNumber(balance.quantity)}
                      </TableCell>
                      {canTransferStock ? (
                        <TableCell align="right">
                          <Button
                            size="small"
                            onClick={() =>
                              openTransfer(balance.product, balance.location)
                            }
                          >
                            Trasladar
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                  {!loading && balances.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={canTransferStock ? 6 : 5}
                        align="center"
                      >
                        No existe stock físico distribuido.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={balanceCount}
              page={balancePage}
              onPageChange={(_event, nextPage) =>
                void changeBalancePagination(nextPage, balancePageSize)
              }
              rowsPerPage={balancePageSize}
              onRowsPerPageChange={(event) =>
                void changeBalancePagination(
                  0,
                  Number(event.target.value),
                )
              }
              rowsPerPageOptions={[10, 25, 50, 100]}
              labelRowsPerPage="Filas por página"
              labelDisplayedRows={({ from, to, count }) =>
                `${from}–${to} de ${count}`
              }
            />
          </Stack>

          <Stack
            spacing={1}
            sx={{
              p: 2,
              border: `1px solid ${colors.border.light}`,
              borderLeft: `4px solid ${colors.accent.main}`,
              borderRadius: colors.radius.lg,
              bgcolor: colors.background.paper,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 850 }}>
              Traslados recientes
            </Typography>
            <TableContainer sx={{ maxHeight: 300 }}>
              <Typography variant="body2" sx={{ color: colors.text.secondary }}>
                Movimientos recientes entre ubicaciones; el stock total no cambia.
              </Typography>
              <Table
                size="small"
                stickyHeader
                aria-label="Traslados recientes de inventario"
              >
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Producto</TableCell>
                    <TableCell>Ruta</TableCell>
                    <TableCell align="right">Cantidad</TableCell>
                    <TableCell>Responsable</TableCell>
                    <TableCell>Motivo</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transfers.map((transfer) => (
                    <TableRow key={transfer.id} hover>
                      <TableCell>{formatDate(transfer.transferred_at)}</TableCell>
                      <TableCell>{transfer.product_model}</TableCell>
                      <TableCell>
                        {transfer.origin_location_name} →{" "}
                        {transfer.destination_location_name}
                      </TableCell>
                      <TableCell align="right">
                        {formatNumber(transfer.quantity)}
                      </TableCell>
                      <TableCell>{transfer.responsible_name}</TableCell>
                      <TableCell>{transfer.reason}</TableCell>
                    </TableRow>
                  ))}
                  {!loading && transfers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        Todavía no hay traslados registrados.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </Stack>
      </SectionCard>

      <Dialog
        open={locationForm.open}
        onClose={closeLocationForm}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {locationForm.editing ? "Editar ubicación" : "Nueva ubicación"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {locationForm.editing?.is_regularization ? (
              <Alert severity="info" variant="outlined">
                Esta ubicación técnica conserva el stock anterior a la
                distribución formal. Su identidad no puede cambiarse.
              </Alert>
            ) : null}
            <TextField
              label="Nombre operativo"
              value={locationForm.name}
              onChange={(event) =>
                setLocationForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              required
              disabled={Boolean(locationForm.editing?.is_regularization)}
            />
            <TextField
              label="Tipo de ubicación"
              select
              value={locationForm.locationType}
              onChange={(event) =>
                setLocationForm((current) => ({
                  ...current,
                  locationType: event.target
                    .value as typeof current.locationType,
                  custodian:
                    event.target.value === "DOMICILIO_CUSTODIA"
                      ? current.custodian
                      : "",
                }))
              }
              disabled={Boolean(locationForm.editing?.is_regularization)}
            >
              {locationTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </TextField>
            {locationForm.locationType === "DOMICILIO_CUSTODIA" ? (
              <TextField
                label="Colaborador custodio"
                select
                value={locationForm.custodian}
                onChange={(event) =>
                  setLocationForm((current) => ({
                    ...current,
                    custodian: event.target.value,
                  }))
                }
                required
                helperText="No se almacena la dirección residencial completa."
              >
                {collaborators.map((collaborator) => (
                  <MenuItem
                    key={collaborator.id}
                    value={String(collaborator.id)}
                  >
                    {collaborator.full_name}
                    {collaborator.position
                      ? ` — ${collaborator.position}`
                      : ""}
                  </MenuItem>
                ))}
              </TextField>
            ) : null}
            <TextField
              label="Ciudad o comuna"
              value={locationForm.city}
              onChange={(event) =>
                setLocationForm((current) => ({
                  ...current,
                  city: event.target.value,
                }))
              }
            />
            <TextField
              label="Referencia operativa"
              value={locationForm.description}
              onChange={(event) =>
                setLocationForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              multiline
              minRows={2}
              helperText="Ej.: bodega norte, faena o punto de entrega. No registre domicilios particulares completos."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeLocationForm}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => void saveLocation()}
            disabled={saving || !locationFormIsValid}
          >
            {saving ? "Guardando..." : "Guardar ubicación"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={transferForm.open}
        onClose={closeTransfer}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Transferir stock entre ubicaciones</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info" variant="outlined">
              El traslado cambia la custodia física, pero no aumenta ni
              disminuye el stock total del producto.
            </Alert>
            {transferErrorMessage ? (
              <Alert severity="error" variant="outlined">
                {transferErrorMessage}
              </Alert>
            ) : null}
            {Object.keys(transferFieldErrors).length > 0 ? (
              <Alert severity="warning" variant="outlined">
                Revisa los campos marcados antes de confirmar el traslado.
              </Alert>
            ) : null}
            <TextField
              label="Producto"
              value={
                selectedOriginBalance
                  ? `${selectedOriginBalance.product_category} — ${selectedOriginBalance.product_model} · ${selectedOriginBalance.product_sap_code || "Sin SAP"}`
                  : "Cargando producto..."
              }
              disabled
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Ubicación de origen"
                select
                value={transferForm.originLocation}
                onChange={(event) => {
                  clearTransferFieldError("origin_location");
                  setTransferForm((current) => ({
                    ...current,
                    originLocation: event.target.value,
                    quantity: "",
                  }));
                }}
                fullWidth
                required
                disabled={!transferForm.product}
                error={Boolean(transferFieldErrors.origin_location)}
                helperText={
                  transferFieldErrors.origin_location ||
                  "Solo se muestran ubicaciones donde el producto tiene stock."
                }
              >
                {originBalances.map((balance) => (
                  <MenuItem
                    key={balance.location}
                    value={String(balance.location)}
                  >
                    {balance.location_name} ({formatNumber(balance.quantity)})
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Ubicación de destino"
                select
                value={transferForm.destinationLocation}
                onChange={(event) => {
                  clearTransferFieldError("destination_location");
                  setTransferForm((current) => ({
                    ...current,
                    destinationLocation: event.target.value,
                  }));
                }}
                fullWidth
                required
                disabled={!transferForm.originLocation}
                error={Boolean(transferFieldErrors.destination_location)}
                helperText={
                  transferFieldErrors.destination_location ||
                  "El destino puede ser cualquier ubicación activa distinta del origen."
                }
              >
                {activeLocations
                  .filter(
                    (location) =>
                      String(location.id) !== transferForm.originLocation,
                  )
                  .map((location) => (
                    <MenuItem key={location.id} value={String(location.id)}>
                      {location.name}
                    </MenuItem>
                  ))}
              </TextField>
            </Stack>
            <TextField
              label="Cantidad a trasladar"
              type="number"
              value={transferForm.quantity}
              onChange={(event) => {
                clearTransferFieldError("quantity");
                setTransferForm((current) => ({
                  ...current,
                  quantity: event.target.value,
                }));
              }}
              required
              error={
                Boolean(transferFieldErrors.quantity) ||
                transferQuantity >
                  (selectedOriginBalance?.quantity || Number.POSITIVE_INFINITY)
              }
              helperText={
                transferFieldErrors.quantity ||
                (selectedOriginBalance
                  ? `Disponible en origen: ${formatNumber(selectedOriginBalance.quantity)}`
                  : "Seleccione el producto y la ubicación de origen.")
              }
            />
            <TextField
              label="Motivo del traslado"
              value={transferForm.reason}
              onChange={(event) => {
                clearTransferFieldError("reason");
                setTransferForm((current) => ({
                  ...current,
                  reason: event.target.value,
                }));
              }}
              required
              multiline
              minRows={2}
              error={Boolean(transferFieldErrors.reason)}
              helperText={
                transferFieldErrors.reason ||
                "Obligatorio. Explica por qué se mueve el stock; quedará registrado en la trazabilidad."
              }
            />
            {sensitiveTransfer ? (
              <>
                <Alert severity="warning" variant="outlined">
                  Este traslado involucra una custodia personal o una ubicación de
                  cliente/faena, por lo que necesita identificar el documento que
                  respalda la entrega o recepción.
                </Alert>
                <TextField
                  label="Documento de respaldo"
                  placeholder="Ej.: Guía 1842, acta de entrega 07 o ticket INC-325"
                  value={transferForm.evidenceReference}
                  onChange={(event) => {
                    clearTransferFieldError("evidence_reference");
                    setTransferForm((current) => ({
                      ...current,
                      evidenceReference: event.target.value,
                    }));
                  }}
                  required
                  error={
                    Boolean(transferFieldErrors.evidence_reference) ||
                    !transferForm.evidenceReference.trim()
                  }
                  helperText={
                    transferFieldErrors.evidence_reference ||
                    "Escribe el número o nombre de la guía de despacho, acta, ticket o solicitud que acredita el movimiento."
                  }
                />
              </>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeTransfer}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => void saveTransfer()}
            disabled={saving || !transferIsValid}
          >
            {saving ? "Transfiriendo..." : "Confirmar traslado"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(archiveState.location)}
        onClose={() => setArchiveState(emptyArchiveLocation)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Archivar ubicación</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="warning" variant="outlined">
              Sólo se archivará si no tiene stock ni recepciones pendientes.
            </Alert>
            <TextField
              label="Ubicación"
              value={archiveState.location?.name || ""}
              disabled
            />
            <TextField
              label="Motivo"
              value={archiveState.reason}
              onChange={(event) =>
                setArchiveState((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
              multiline
              minRows={2}
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArchiveState(emptyArchiveLocation)}>
            Cancelar
          </Button>
          <Button
            color="warning"
            variant="contained"
            onClick={() => void archiveLocation()}
            disabled={saving || !archiveState.reason.trim()}
          >
            {saving ? "Archivando..." : "Archivar"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
