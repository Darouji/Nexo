import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import axios from "axios";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import LoginIcon from "@mui/icons-material/Login";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import SecurityIcon from "@mui/icons-material/Security";
import TimelineIcon from "@mui/icons-material/Timeline";
import type { GridColDef } from "@mui/x-data-grid";
import { SmartDataGrid } from "../components/SmartDataGrid";
import {
  fetchAuditActivity,
  fetchRecordChangeHistory,
} from "../services/auditService";
import type { AuditLog, RecordChangeLog } from "../services/auditService";
import { colors } from "../theme/colors";

type RecordSearchForm = {
  app_label: string;
  model: string;
  object_id: string;
};

const actionOptions = [
  { value: "", label: "Todas las acciones" },
  { value: "CREAR", label: "Crear" },
  { value: "EDITAR", label: "Editar" },
  { value: "ANULAR", label: "Anular" },
  { value: "INACTIVAR", label: "Inactivar" },
  { value: "ARCHIVAR", label: "Archivar" },
  { value: "RESTAURAR", label: "Restaurar" },
  { value: "IMPORTAR", label: "Importar" },
  { value: "EXPORTAR", label: "Exportar" },
  { value: "REEMPLAZAR_DOCUMENTO", label: "Reemplazar documento" },
  { value: "CAMBIAR_ESTADO", label: "Cambiar estado" },
  { value: "AJUSTE_INVENTARIO", label: "Ajuste inventario" },
  { value: "LOGIN", label: "Inicio de sesión" },
  { value: "LOGOUT", label: "Cierre de sesión" },
  { value: "ELIMINAR", label: "Eliminar" },
];

const moduleOptions = [
  { value: "", label: "Todos los módulos" },
  { value: "auth", label: "Auth" },
  { value: "accounts", label: "Usuarios" },
  { value: "collaborators", label: "Colaboradores" },
  { value: "commercial", label: "Comercial" },
  { value: "inventory", label: "Inventario" },
  { value: "sales", label: "Ventas" },
  { value: "documents", label: "Documentos" },
  { value: "imports", label: "Importaciones" },
];

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { detail?: string; [key: string]: unknown }
      | undefined;

    if (data?.detail) {
      return data.detail;
    }

    if (data && typeof data === "object") {
      return Object.entries(data)
        .map(([field, value]) => {
          if (Array.isArray(value)) {
            return `${field}: ${value.join(", ")}`;
          }

          return `${field}: ${String(value)}`;
        })
        .join(" | ");
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "No se pudo cargar la auditoría.";
}

function normalizeSearch(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("es-CL").format(Number(value || 0));
}

function toReadableJson(value: unknown) {
  if (!value) {
    return "Sin datos";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getActionAccent(action: string) {
  if (action === "LOGIN" || action === "LOGOUT") {
    return {
      main: colors.primary.main,
      soft: colors.primary.soft,
      border: colors.primary.border,
    };
  }

  if (["ANULAR", "ELIMINAR", "INACTIVAR"].includes(action)) {
    return {
      main: colors.status.error,
      soft: colors.status.errorSoft,
      border: colors.status.error,
    };
  }

  if (
    ["IMPORTAR", "AJUSTE_INVENTARIO", "REEMPLAZAR_DOCUMENTO"].includes(action)
  ) {
    return {
      main: colors.status.warning,
      soft: colors.status.warningSoft,
      border: colors.secondary.border,
    };
  }

  return {
    main: colors.modules.audit.main,
    soft: colors.modules.audit.soft,
    border: colors.modules.audit.border,
  };
}

function ActionChip({ action, label }: { action: string; label: string }) {
  const accent = getActionAccent(action);

  return (
    <Chip
      label={label || action || "SIN ACCIÓN"}
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
}: {
  title: string;
  value: string;
  helper: string;
  icon: ReactNode;
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
              color: colors.modules.audit.main,
              bgcolor: colors.modules.audit.soft,
              border: `1px solid ${colors.modules.audit.border}`,
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

export function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [recordChanges, setRecordChanges] = useState<RecordChangeLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [selectedChange, setSelectedChange] = useState<RecordChangeLog | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [limit, setLimit] = useState("100");
  const [recordForm, setRecordForm] = useState<RecordSearchForm>({
    app_label: "",
    model: "",
    object_id: "",
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingChanges, setLoadingChanges] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadAuditLogs = useCallback(
    async (mode: "initial" | "refresh") => {
      try {
        if (mode === "initial") {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setErrorMessage("");

        const payload = await fetchAuditActivity({
          limit: Number(limit || 100),
          module: moduleFilter,
          action: actionFilter,
        });

        setLogs(payload.results);
      } catch (error: unknown) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        if (mode === "initial") {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [actionFilter, limit, moduleFilter],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadAuditLogs("initial");
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadAuditLogs]);

  const filteredLogs = useMemo(() => {
    const term = normalizeSearch(searchTerm.trim());

    if (!term) {
      return logs;
    }

    return logs.filter((log) =>
      [
        log.actor_name,
        log.action,
        log.action_display,
        log.origin,
        log.origin_display,
        log.module,
        log.model_name,
        log.object_id,
        log.object_repr,
        log.ip_address,
        log.reason,
      ].some((value) => normalizeSearch(value).includes(term)),
    );
  }, [logs, searchTerm]);

  const summary = useMemo(() => {
    const loginEvents = logs.filter((log) =>
      ["LOGIN", "LOGOUT"].includes(log.action),
    ).length;

    const criticalEvents = logs.filter((log) =>
      ["ANULAR", "ELIMINAR", "INACTIVAR", "REEMPLAZAR_DOCUMENTO"].includes(
        log.action,
      ),
    ).length;

    const modules = new Set(logs.map((log) => log.module).filter(Boolean)).size;

    return {
      loginEvents,
      criticalEvents,
      modules,
      systemEvents: logs.filter((log) => !log.actor).length,
    };
  }, [logs]);

  const handleLoadRecordChanges = useCallback(async () => {
    if (
      !recordForm.app_label.trim() ||
      !recordForm.model.trim() ||
      !recordForm.object_id.trim()
    ) {
      setErrorMessage("Debes ingresar app_label, model y object_id.");
      return;
    }

    try {
      setLoadingChanges(true);
      setErrorMessage("");
      setSuccessMessage("");

      const payload = await fetchRecordChangeHistory({
        app_label: recordForm.app_label,
        model: recordForm.model,
        object_id: recordForm.object_id,
        limit: 100,
      });

      setRecordChanges(payload.results);
      setSuccessMessage(
        `Historial cargado: ${payload.count} cambios encontrados.`,
      );
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoadingChanges(false);
    }
  }, [recordForm]);

  const auditColumns = useMemo<GridColDef[]>(() => {
    return [
      {
        field: "created_at",
        headerName: "Fecha",
        width: 175,
        renderCell: (params) => formatDateTime(String(params.value || "")),
      },
      {
        field: "actor_name",
        headerName: "Usuario",
        minWidth: 170,
        flex: 0.7,
        renderCell: (params) => params.value || "Sistema",
      },
      {
        field: "action",
        headerName: "Acción",
        minWidth: 190,
        flex: 0.7,
        renderCell: (params) => {
          const log = params.row as AuditLog;

          return <ActionChip action={log.action} label={log.action_display} />;
        },
      },
      {
        field: "module",
        headerName: "Módulo",
        minWidth: 150,
        flex: 0.6,
        renderCell: (params) => params.value || "Sin módulo",
      },
      {
        field: "model_name",
        headerName: "Modelo",
        minWidth: 150,
        flex: 0.6,
        renderCell: (params) => params.value || "Sin modelo",
      },
      {
        field: "object_repr",
        headerName: "Registro",
        minWidth: 240,
        flex: 1,
        renderCell: (params) => params.value || "Sin registro",
      },
      {
        field: "origin_display",
        headerName: "Origen",
        width: 145,
        renderCell: (params) => params.value || "Sin origen",
      },
      {
        field: "ip_address",
        headerName: "IP",
        width: 145,
        renderCell: (params) => params.value || "Sin IP",
      },
      {
        field: "actions",
        headerName: "Detalle",
        width: 120,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Button
            size="small"
            variant="outlined"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedLog(params.row as AuditLog);
            }}
          >
            Ver
          </Button>
        ),
      },
    ];
  }, []);

  const changeColumns = useMemo<GridColDef[]>(() => {
    return [
      {
        field: "created_at",
        headerName: "Fecha",
        width: 175,
        renderCell: (params) => formatDateTime(String(params.value || "")),
      },
      {
        field: "changed_by_name",
        headerName: "Usuario",
        minWidth: 170,
        flex: 0.7,
        renderCell: (params) => params.value || "Sistema",
      },
      {
        field: "action",
        headerName: "Acción",
        minWidth: 180,
        flex: 0.7,
        renderCell: (params) => {
          const change = params.row as RecordChangeLog;

          return (
            <ActionChip action={change.action} label={change.action_display} />
          );
        },
      },
      {
        field: "field_name",
        headerName: "Campo",
        minWidth: 160,
        flex: 0.6,
        renderCell: (params) => params.value || "Sin campo",
      },
      {
        field: "old_value",
        headerName: "Valor anterior",
        minWidth: 220,
        flex: 1,
        renderCell: (params) => params.value || "-",
      },
      {
        field: "new_value",
        headerName: "Valor nuevo",
        minWidth: 220,
        flex: 1,
        renderCell: (params) => params.value || "-",
      },
      {
        field: "origin_display",
        headerName: "Origen",
        width: 145,
        renderCell: (params) => params.value || "Sin origen",
      },
      {
        field: "actions",
        headerName: "Detalle",
        width: 120,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Button
            size="small"
            variant="outlined"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedChange(params.row as RecordChangeLog);
            }}
          >
            Ver
          </Button>
        ),
      },
    ];
  }, []);

  if (loading) {
    return (
      <Stack spacing={2} sx={{ alignItems: "center", py: 6 }}>
        <CircularProgress />
        <Typography sx={{ color: colors.text.secondary }}>
          Cargando auditoría...
        </Typography>
      </Stack>
    );
  }

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
              label="Trazabilidad del sistema"
              icon={<SecurityIcon />}
              variant="outlined"
              size="small"
              sx={{
                mb: 2,
                color: colors.modules.audit.main,
                bgcolor: colors.modules.audit.soft,
                borderColor: colors.modules.audit.border,
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
              Auditoría
            </Typography>

            <Typography
              variant="h6"
              sx={{
                color: colors.text.secondary,
                maxWidth: 850,
                lineHeight: 1.5,
                fontWeight: 500,
              }}
            >
              Actividad reciente, eventos críticos, accesos, importaciones y
              trazabilidad de cambios por registro.
            </Typography>
          </Box>

          <Button
            variant="contained"
            startIcon={
              refreshing ? <CircularProgress size={18} /> : <RefreshIcon />
            }
            onClick={() => void loadAuditLogs("refresh")}
            disabled={refreshing}
          >
            {refreshing ? "Actualizando..." : "Actualizar"}
          </Button>
        </Stack>
      </Box>

      {errorMessage ? (
        <Alert severity="warning" variant="outlined">
          {errorMessage}
        </Alert>
      ) : null}

      {successMessage ? (
        <Alert severity="success" variant="outlined">
          {successMessage}
        </Alert>
      ) : null}

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
          title="Eventos cargados"
          value={formatNumber(logs.length)}
          helper={`Límite actual: ${limit}`}
          icon={<TimelineIcon />}
        />

        <SummaryCard
          title="Accesos"
          value={formatNumber(summary.loginEvents)}
          helper="Login y logout registrados"
          icon={<LoginIcon />}
        />

        <SummaryCard
          title="Eventos críticos"
          value={formatNumber(summary.criticalEvents)}
          helper="Anulación, eliminación, inactivación o reemplazo"
          icon={<AdminPanelSettingsIcon />}
        />

        <SummaryCard
          title="Módulos"
          value={formatNumber(summary.modules)}
          helper={`${formatNumber(summary.systemEvents)} eventos del sistema`}
          icon={<SecurityIcon />}
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
              direction={{ xs: "column", xl: "row" }}
              spacing={2}
              sx={{
                alignItems: { xs: "stretch", xl: "center" },
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Typography
                  variant="h5"
                  sx={{ color: colors.text.primary, fontWeight: 900 }}
                >
                  Actividad reciente
                </Typography>

                <Typography variant="body2" sx={{ color: colors.text.muted }}>
                  El backend entrega la actividad global reciente filtrable por
                  módulo y acción.
                </Typography>
              </Box>

              <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                <TextField
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar en eventos..."
                  size="small"
                  sx={{ minWidth: { xs: "100%", md: 260 } }}
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
                  label="Módulo"
                  value={moduleFilter}
                  onChange={(event) => setModuleFilter(event.target.value)}
                  size="small"
                  sx={{ minWidth: { xs: "100%", md: 180 } }}
                >
                  {moduleOptions.map((option) => (
                    <MenuItem key={option.value || "all"} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  select
                  label="Acción"
                  value={actionFilter}
                  onChange={(event) => setActionFilter(event.target.value)}
                  size="small"
                  sx={{ minWidth: { xs: "100%", md: 220 } }}
                >
                  {actionOptions.map((option) => (
                    <MenuItem key={option.value || "all"} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  select
                  label="Límite"
                  value={limit}
                  onChange={(event) => setLimit(event.target.value)}
                  size="small"
                  sx={{ minWidth: { xs: "100%", md: 120 } }}
                >
                  <MenuItem value="50">50</MenuItem>
                  <MenuItem value="100">100</MenuItem>
                  <MenuItem value="150">150</MenuItem>
                  <MenuItem value="200">200</MenuItem>
                </TextField>

                <Button
                  variant="outlined"
                  onClick={() => void loadAuditLogs("refresh")}
                  disabled={refreshing}
                  sx={{
                    color: colors.text.primary,
                    borderColor: colors.border.medium,
                  }}
                >
                  Aplicar
                </Button>
              </Stack>
            </Stack>

            <SmartDataGrid
              rows={filteredLogs}
              columns={auditColumns}
              loading={refreshing}
            />
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
          <Stack spacing={2.5}>
            <Box>
              <Typography
                variant="h5"
                sx={{ color: colors.text.primary, fontWeight: 900 }}
              >
                Historial por registro
              </Typography>

              <Typography variant="body2" sx={{ color: colors.text.muted }}>
                Consulta cambios campo a campo indicando app_label, model y
                object_id.
              </Typography>
            </Box>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField
                label="App label"
                value={recordForm.app_label}
                onChange={(event) =>
                  setRecordForm((current) => ({
                    ...current,
                    app_label: event.target.value,
                  }))
                }
                placeholder="sales"
                size="small"
                fullWidth
              />

              <TextField
                label="Modelo"
                value={recordForm.model}
                onChange={(event) =>
                  setRecordForm((current) => ({
                    ...current,
                    model: event.target.value,
                  }))
                }
                placeholder="venta"
                size="small"
                fullWidth
              />

              <TextField
                label="Object ID"
                value={recordForm.object_id}
                onChange={(event) =>
                  setRecordForm((current) => ({
                    ...current,
                    object_id: event.target.value,
                  }))
                }
                placeholder="1"
                size="small"
                fullWidth
              />

              <Button
                variant="contained"
                startIcon={
                  loadingChanges ? (
                    <CircularProgress size={18} />
                  ) : (
                    <ManageSearchIcon />
                  )
                }
                onClick={() => void handleLoadRecordChanges()}
                disabled={loadingChanges}
              >
                Buscar
              </Button>
            </Stack>

            {recordChanges.length > 0 ? (
              <SmartDataGrid
                rows={recordChanges}
                columns={changeColumns}
                loading={loadingChanges}
              />
            ) : (
              <Alert severity="info" variant="outlined">
                Ingresa un registro para revisar su historial de cambios.
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Detalle de auditoría</DialogTitle>

        <DialogContent>
          {selectedLog ? (
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                <ActionChip
                  action={selectedLog.action}
                  label={selectedLog.action_display}
                />

                <Chip
                  label={selectedLog.origin_display || selectedLog.origin}
                  size="small"
                  variant="outlined"
                  sx={{
                    color: colors.modules.audit.main,
                    bgcolor: colors.modules.audit.soft,
                    borderColor: colors.modules.audit.border,
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
                    Usuario
                  </Typography>

                  <Typography sx={{ color: colors.text.primary }}>
                    {selectedLog.actor_name || "Sistema"}
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: colors.text.secondary, fontWeight: 800 }}
                  >
                    Fecha
                  </Typography>

                  <Typography sx={{ color: colors.text.primary }}>
                    {formatDateTime(selectedLog.created_at)}
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: colors.text.secondary, fontWeight: 800 }}
                  >
                    Módulo / modelo
                  </Typography>

                  <Typography sx={{ color: colors.text.primary }}>
                    {selectedLog.module || "Sin módulo"} ·{" "}
                    {selectedLog.model_name || "Sin modelo"}
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: colors.text.secondary, fontWeight: 800 }}
                  >
                    Registro afectado
                  </Typography>

                  <Typography sx={{ color: colors.text.primary }}>
                    {selectedLog.object_repr || "Sin registro"}
                  </Typography>

                  <Typography
                    variant="caption"
                    sx={{ color: colors.text.muted }}
                  >
                    ID: {selectedLog.object_id || "sin ID"}
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: colors.text.secondary, fontWeight: 800 }}
                  >
                    IP
                  </Typography>

                  <Typography sx={{ color: colors.text.primary }}>
                    {selectedLog.ip_address || "Sin IP"}
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: colors.text.secondary, fontWeight: 800 }}
                  >
                    Motivo
                  </Typography>

                  <Typography sx={{ color: colors.text.primary }}>
                    {selectedLog.reason || "Sin motivo"}
                  </Typography>
                </Box>
              </Box>

              <Divider />

              <Box>
                <Typography
                  variant="body2"
                  sx={{ color: colors.text.secondary, fontWeight: 800, mb: 1 }}
                >
                  Metadatos
                </Typography>

                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    p: 2,
                    borderRadius: colors.radius.md,
                    border: `1px solid ${colors.border.light}`,
                    bgcolor: colors.surface.soft,
                    color: colors.text.secondary,
                    overflow: "auto",
                    fontSize: 13,
                  }}
                >
                  {toReadableJson(selectedLog.metadata)}
                </Box>
              </Box>

              <Box>
                <Typography
                  variant="body2"
                  sx={{ color: colors.text.secondary, fontWeight: 800, mb: 1 }}
                >
                  User agent
                </Typography>

                <Typography
                  variant="body2"
                  sx={{
                    color: colors.text.muted,
                    overflowWrap: "anywhere",
                  }}
                >
                  {selectedLog.user_agent || "Sin user agent"}
                </Typography>
              </Box>
            </Stack>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selectedChange)}
        onClose={() => setSelectedChange(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Detalle de cambio por registro</DialogTitle>

        <DialogContent>
          {selectedChange ? (
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                <ActionChip
                  action={selectedChange.action}
                  label={selectedChange.action_display}
                />

                <Chip
                  label={selectedChange.origin_display || selectedChange.origin}
                  size="small"
                  variant="outlined"
                  sx={{
                    color: colors.modules.audit.main,
                    bgcolor: colors.modules.audit.soft,
                    borderColor: colors.modules.audit.border,
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
                    Registro
                  </Typography>

                  <Typography sx={{ color: colors.text.primary }}>
                    {selectedChange.content_type_label} · ID{" "}
                    {selectedChange.object_id}
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: colors.text.secondary, fontWeight: 800 }}
                  >
                    Usuario
                  </Typography>

                  <Typography sx={{ color: colors.text.primary }}>
                    {selectedChange.changed_by_name || "Sistema"}
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: colors.text.secondary, fontWeight: 800 }}
                  >
                    Campo
                  </Typography>

                  <Typography sx={{ color: colors.text.primary }}>
                    {selectedChange.field_name || "Sin campo"}
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: colors.text.secondary, fontWeight: 800 }}
                  >
                    Fecha
                  </Typography>

                  <Typography sx={{ color: colors.text.primary }}>
                    {formatDateTime(selectedChange.created_at)}
                  </Typography>
                </Box>
              </Box>

              <Divider />

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
                    sx={{
                      color: colors.text.secondary,
                      fontWeight: 800,
                      mb: 1,
                    }}
                  >
                    Valor anterior
                  </Typography>

                  <Box
                    component="pre"
                    sx={{
                      m: 0,
                      p: 2,
                      borderRadius: colors.radius.md,
                      border: `1px solid ${colors.border.light}`,
                      bgcolor: colors.surface.soft,
                      color: colors.text.secondary,
                      overflow: "auto",
                      fontSize: 13,
                    }}
                  >
                    {selectedChange.old_value || "-"}
                  </Box>
                </Box>

                <Box>
                  <Typography
                    variant="body2"
                    sx={{
                      color: colors.text.secondary,
                      fontWeight: 800,
                      mb: 1,
                    }}
                  >
                    Valor nuevo
                  </Typography>

                  <Box
                    component="pre"
                    sx={{
                      m: 0,
                      p: 2,
                      borderRadius: colors.radius.md,
                      border: `1px solid ${colors.border.light}`,
                      bgcolor: colors.surface.soft,
                      color: colors.text.secondary,
                      overflow: "auto",
                      fontSize: 13,
                    }}
                  >
                    {selectedChange.new_value || "-"}
                  </Box>
                </Box>
              </Box>

              <Box>
                <Typography
                  variant="body2"
                  sx={{ color: colors.text.secondary, fontWeight: 800 }}
                >
                  Motivo
                </Typography>

                <Typography sx={{ color: colors.text.primary }}>
                  {selectedChange.reason || "Sin motivo"}
                </Typography>
              </Box>
            </Stack>
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
