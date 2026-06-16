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
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import ErrorIcon from "@mui/icons-material/Error";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import TableChartIcon from "@mui/icons-material/TableChart";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import type { GridColDef } from "@mui/x-data-grid";
import { SmartDataGrid } from "../components/SmartDataGrid";
import {
  createImportBatch,
  fetchImportBatches,
  fetchImportRows,
  prevalidateImportBatch,
  processImportBatch,
} from "../services/importService";
import type { ImportBatch, ImportRow } from "../services/importService";
import { colors } from "../theme/colors";

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

  return "No se pudo completar la operación.";
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

function formatFileSize(bytes: number | null | undefined) {
  const value = Number(bytes || 0);

  if (value <= 0) {
    return "Sin tamaño";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: unitIndex === 0 ? 0 : 1,
  }).format(size)} ${units[unitIndex]}`;
}

function getBatchStatusColor(status: string) {
  if (status === "PROCESADO") {
    return {
      main: colors.status.success,
      soft: colors.status.successSoft,
      border: colors.status.success,
    };
  }

  if (status === "FALLIDO" || status === "CANCELADO") {
    return {
      main: colors.status.error,
      soft: colors.status.errorSoft,
      border: colors.status.error,
    };
  }

  if (status === "PREVALIDADO") {
    return {
      main: colors.modules.excel.main,
      soft: colors.modules.excel.soft,
      border: colors.modules.excel.border,
    };
  }

  return {
    main: colors.status.warning,
    soft: colors.status.warningSoft,
    border: colors.secondary.border,
  };
}

function getRowStatusColor(status: string) {
  if (status === "VALIDO" || status === "IMPORTADO") {
    return {
      main: colors.status.success,
      soft: colors.status.successSoft,
      border: colors.status.success,
    };
  }

  if (status === "ERROR") {
    return {
      main: colors.status.error,
      soft: colors.status.errorSoft,
      border: colors.status.error,
    };
  }

  if (status === "REQUIERE_REVISION" || status === "DUPLICADO") {
    return {
      main: colors.status.warning,
      soft: colors.status.warningSoft,
      border: colors.secondary.border,
    };
  }

  return {
    main: colors.text.muted,
    soft: colors.action.muted,
    border: colors.border.medium,
  };
}

function StatusChip({
  label,
  status,
  type,
}: {
  label: string;
  status: string;
  type: "batch" | "row";
}) {
  const color =
    type === "batch" ? getBatchStatusColor(status) : getRowStatusColor(status);

  return (
    <Chip
      label={label || status || "SIN ESTADO"}
      size="small"
      variant="outlined"
      sx={{
        color: color.main,
        bgcolor: color.soft,
        borderColor: color.border,
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
  accent,
}: {
  title: string;
  value: string;
  helper: string;
  icon: ReactNode;
  accent: {
    main: string;
    soft: string;
    border: string;
  };
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
              color: accent.main,
              bgcolor: accent.soft,
              border: `1px solid ${accent.border}`,
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

function getRowMessages(row: ImportRow) {
  if (!Array.isArray(row.messages) || row.messages.length === 0) {
    return "Sin mensajes";
  }

  return row.messages.map((message) => String(message)).join(" | ");
}

export function ImportsPage() {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<ImportBatch | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState("PRODUCTOS");
  const [uploadNotes, setUploadNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionBatchId, setActionBatchId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadImports = useCallback(async (mode: "initial" | "refresh") => {
    try {
      if (mode === "initial") {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setErrorMessage("");

      const [batchesData, rowsData] = await Promise.all([
        fetchImportBatches(),
        fetchImportRows(),
      ]);

      setBatches(batchesData);
      setRows(rowsData);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      if (mode === "initial") {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadImports("initial");
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadImports]);

  const filteredBatches = useMemo(() => {
    const term = normalizeSearch(searchTerm.trim());

    if (!term) {
      return batches;
    }

    return batches.filter((batch) =>
      [
        batch.target,
        batch.target_display,
        batch.original_filename,
        batch.file_sha256,
        batch.batch_status,
        batch.batch_status_display,
        batch.notes,
        batch.processed_by_name,
        batch.status,
      ].some((value) => normalizeSearch(value).includes(term)),
    );
  }, [batches, searchTerm]);

  const selectedBatchRows = useMemo(() => {
    if (!selectedBatch) {
      return [];
    }

    const fullRows = rows.filter((row) => row.batch === selectedBatch.id);

    if (fullRows.length > 0) {
      return fullRows;
    }

    return selectedBatch.rows_preview ?? [];
  }, [rows, selectedBatch]);

  const summary = useMemo(() => {
    const totalRows = batches.reduce(
      (total, batch) => total + Number(batch.total_rows || 0),
      0,
    );
    const errorRows = batches.reduce(
      (total, batch) => total + Number(batch.error_rows || 0),
      0,
    );
    const reviewRows = batches.reduce(
      (total, batch) => total + Number(batch.review_rows || 0),
      0,
    );
    const importedRows = batches.reduce(
      (total, batch) => total + Number(batch.imported_rows || 0),
      0,
    );

    return {
      totalRows,
      errorRows,
      reviewRows,
      importedRows,
      pendingRows: errorRows + reviewRows,
      processedBatches: batches.filter(
        (batch) => batch.batch_status === "PROCESADO",
      ).length,
    };
  }, [batches]);

  const updateBatchInState = useCallback((updatedBatch: ImportBatch) => {
    setBatches((current) =>
      current.map((batch) =>
        batch.id === updatedBatch.id ? updatedBatch : batch,
      ),
    );

    setSelectedBatch((current) =>
      current?.id === updatedBatch.id ? updatedBatch : current,
    );
  }, []);

  const handleCreateBatch = async () => {
    if (!selectedFile) {
      setErrorMessage("Debes seleccionar un archivo .xlsx o .csv.");
      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      const createdBatch = await createImportBatch({
        target: uploadTarget,
        file: selectedFile,
        notes: uploadNotes,
      });

      setBatches((current) => [createdBatch, ...current]);
      setSelectedFile(null);
      setUploadNotes("");
      setUploadTarget("PRODUCTOS");
      setUploadDialogOpen(false);
      setSuccessMessage(
        "Archivo cargado correctamente. Ahora puedes prevalidarlo.",
      );
      await loadImports("refresh");
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handlePrevalidate = useCallback(
    async (batch: ImportBatch) => {
      try {
        setActionBatchId(batch.id);
        setErrorMessage("");
        setSuccessMessage("");

        const updatedBatch = await prevalidateImportBatch(batch.id);
        updateBatchInState(updatedBatch);
        setSuccessMessage(
          `Importación #${batch.id} prevalidada correctamente.`,
        );
        await loadImports("refresh");
      } catch (error: unknown) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setActionBatchId(null);
      }
    },
    [loadImports, updateBatchInState],
  );

  const handleProcess = useCallback(
    async (batch: ImportBatch) => {
      try {
        setActionBatchId(batch.id);
        setErrorMessage("");
        setSuccessMessage("");

        const updatedBatch = await processImportBatch(batch.id);
        updateBatchInState(updatedBatch);
        setSuccessMessage(`Importación #${batch.id} procesada correctamente.`);
        await loadImports("refresh");
      } catch (error: unknown) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setActionBatchId(null);
      }
    },
    [loadImports, updateBatchInState],
  );

  const batchColumns = useMemo<GridColDef[]>(() => {
    return [
      {
        field: "original_filename",
        headerName: "Archivo",
        minWidth: 240,
        flex: 1,
        renderCell: (params) => params.value || "Sin nombre",
      },
      {
        field: "target_display",
        headerName: "Destino",
        width: 140,
        renderCell: (params) => params.value || "Sin destino",
      },
      {
        field: "batch_status_display",
        headerName: "Estado",
        width: 155,
        renderCell: (params) => {
          const batch = params.row as ImportBatch;

          return (
            <StatusChip
              label={batch.batch_status_display}
              status={batch.batch_status}
              type="batch"
            />
          );
        },
      },
      {
        field: "total_rows",
        headerName: "Filas",
        width: 105,
        renderCell: (params) => formatNumber(Number(params.value || 0)),
      },
      {
        field: "valid_rows",
        headerName: "Válidas",
        width: 105,
        renderCell: (params) => formatNumber(Number(params.value || 0)),
      },
      {
        field: "error_rows",
        headerName: "Errores",
        width: 105,
        renderCell: (params) => formatNumber(Number(params.value || 0)),
      },
      {
        field: "review_rows",
        headerName: "Revisión",
        width: 115,
        renderCell: (params) => formatNumber(Number(params.value || 0)),
      },
      {
        field: "imported_rows",
        headerName: "Importadas",
        width: 125,
        renderCell: (params) => formatNumber(Number(params.value || 0)),
      },
      {
        field: "created_at",
        headerName: "Creado",
        width: 170,
        renderCell: (params) => formatDateTime(String(params.value || "")),
      },
      {
        field: "actions",
        headerName: "Acciones",
        width: 310,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const batch = params.row as ImportBatch;
          const isActing = actionBatchId === batch.id;
          const canPrevalidate = ["CREADO", "FALLIDO"].includes(
            batch.batch_status,
          );
          const canProcess = batch.batch_status === "PREVALIDADO";

          return (
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedBatch(batch);
                }}
              >
                Ver
              </Button>

              <Button
                size="small"
                variant="text"
                disabled={isActing || !canPrevalidate}
                onClick={(event) => {
                  event.stopPropagation();
                  void handlePrevalidate(batch);
                }}
              >
                Prevalidar
              </Button>

              <Button
                size="small"
                variant="contained"
                disabled={isActing || !canProcess}
                onClick={(event) => {
                  event.stopPropagation();
                  void handleProcess(batch);
                }}
              >
                Procesar
              </Button>
            </Stack>
          );
        },
      },
    ];
  }, [actionBatchId, handlePrevalidate, handleProcess]);

  const rowColumns = useMemo<GridColDef[]>(() => {
    return [
      {
        field: "row_number",
        headerName: "Fila",
        width: 90,
      },
      {
        field: "row_status_display",
        headerName: "Estado",
        width: 170,
        renderCell: (params) => {
          const row = params.row as ImportRow;

          return (
            <StatusChip
              label={row.row_status_display}
              status={row.row_status}
              type="row"
            />
          );
        },
      },
      {
        field: "messages",
        headerName: "Mensajes",
        minWidth: 260,
        flex: 1,
        sortable: false,
        renderCell: (params) => getRowMessages(params.row as ImportRow),
      },
      {
        field: "imported_repr",
        headerName: "Objeto importado",
        minWidth: 220,
        flex: 0.8,
        renderCell: (params) => params.value || "Sin objeto importado",
      },
      {
        field: "updated_at",
        headerName: "Actualizado",
        width: 170,
        renderCell: (params) => formatDateTime(String(params.value || "")),
      },
    ];
  }, []);

  if (loading) {
    return (
      <Stack spacing={2} sx={{ alignItems: "center", py: 6 }}>
        <CircularProgress />
        <Typography sx={{ color: colors.text.secondary }}>
          Cargando importaciones...
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
              label="Carga inteligente"
              icon={<TableChartIcon />}
              variant="outlined"
              size="small"
              sx={{
                mb: 2,
                color: colors.modules.excel.main,
                bgcolor: colors.modules.excel.soft,
                borderColor: colors.modules.excel.border,
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
              Importaciones Excel
            </Typography>

            <Typography
              variant="h6"
              sx={{
                color: colors.text.secondary,
                maxWidth: 820,
                lineHeight: 1.5,
                fontWeight: 500,
              }}
            >
              Carga archivos .xlsx o .csv, prevalidarlos antes de impactar la
              base de datos y procesa solo lotes revisados.
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              variant="outlined"
              startIcon={
                refreshing ? <CircularProgress size={18} /> : <RefreshIcon />
              }
              onClick={() => void loadImports("refresh")}
              disabled={refreshing}
              sx={{
                color: colors.text.primary,
                borderColor: colors.border.medium,
              }}
            >
              {refreshing ? "Actualizando..." : "Actualizar"}
            </Button>

            <Button
              variant="contained"
              startIcon={<CloudUploadIcon />}
              onClick={() => {
                setErrorMessage("");
                setSuccessMessage("");
                setUploadDialogOpen(true);
              }}
            >
              Cargar archivo
            </Button>
          </Stack>
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
          title="Lotes cargados"
          value={formatNumber(batches.length)}
          helper={`${formatNumber(summary.processedBatches)} procesados`}
          icon={<TableChartIcon />}
          accent={colors.modules.excel}
        />

        <SummaryCard
          title="Filas totales"
          value={formatNumber(summary.totalRows)}
          helper="Filas leídas desde archivos"
          icon={<FactCheckIcon />}
          accent={colors.modules.excel}
        />

        <SummaryCard
          title="Filas importadas"
          value={formatNumber(summary.importedRows)}
          helper="Registros creados o actualizados"
          icon={<CheckCircleIcon />}
          accent={{
            main: colors.status.success,
            soft: colors.status.successSoft,
            border: colors.status.success,
          }}
        />

        <SummaryCard
          title="Errores / revisión"
          value={formatNumber(summary.pendingRows)}
          helper={`${formatNumber(summary.errorRows)} errores y ${formatNumber(
            summary.reviewRows,
          )} por revisar`}
          icon={summary.pendingRows > 0 ? <WarningAmberIcon /> : <ErrorIcon />}
          accent={
            summary.pendingRows > 0
              ? {
                  main: colors.status.warning,
                  soft: colors.status.warningSoft,
                  border: colors.secondary.border,
                }
              : {
                  main: colors.status.success,
                  soft: colors.status.successSoft,
                  border: colors.status.success,
                }
          }
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
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              sx={{
                alignItems: { xs: "stretch", md: "center" },
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Typography
                  variant="h5"
                  sx={{ color: colors.text.primary, fontWeight: 900 }}
                >
                  Lotes de importación
                </Typography>

                <Typography variant="body2" sx={{ color: colors.text.muted }}>
                  Busca por archivo, estado, destino, hash, notas o usuario que
                  procesó.
                </Typography>
              </Box>

              <TextField
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar importaciones..."
                size="small"
                sx={{ minWidth: { xs: "100%", md: 360 } }}
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
            </Stack>

            <SmartDataGrid
              rows={filteredBatches}
              columns={batchColumns}
              loading={refreshing}
            />
          </Stack>
        </CardContent>
      </Card>

      <Dialog
        open={uploadDialogOpen}
        onClose={() => {
          if (!saving) {
            setUploadDialogOpen(false);
          }
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Nueva importación</DialogTitle>

        <DialogContent>
          <Stack spacing={2.2} sx={{ mt: 1 }}>
            <Alert severity="info" variant="outlined">
              Actualmente el backend permite importar productos. El archivo debe
              ser .xlsx o .csv y no superar el tamaño máximo permitido.
            </Alert>

            <TextField
              select
              label="Destino"
              value={uploadTarget}
              onChange={(event) => setUploadTarget(event.target.value)}
              fullWidth
            >
              <MenuItem value="PRODUCTOS">Productos</MenuItem>
            </TextField>

            <Button
              variant="outlined"
              component="label"
              startIcon={<CloudUploadIcon />}
              sx={{
                justifyContent: "flex-start",
                borderColor: selectedFile
                  ? colors.modules.excel.border
                  : colors.border.medium,
                color: selectedFile
                  ? colors.modules.excel.main
                  : colors.text.primary,
              }}
            >
              {selectedFile
                ? selectedFile.name
                : "Seleccionar archivo .xlsx o .csv"}
              <input
                hidden
                type="file"
                accept=".xlsx,.csv"
                onChange={(event) => {
                  setSelectedFile(event.target.files?.[0] ?? null);
                }}
              />
            </Button>

            {selectedFile ? (
              <Typography variant="caption" sx={{ color: colors.text.muted }}>
                Tamaño: {formatFileSize(selectedFile.size)}
              </Typography>
            ) : null}

            <TextField
              label="Notas"
              value={uploadNotes}
              onChange={(event) => setUploadNotes(event.target.value)}
              multiline
              minRows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)} disabled={saving}>
            Cancelar
          </Button>

          <Button
            variant="contained"
            onClick={handleCreateBatch}
            disabled={saving || !selectedFile}
          >
            {saving ? "Cargando..." : "Cargar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(selectedBatch)}
        onClose={() => setSelectedBatch(null)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>
          {selectedBatch
            ? `Importación #${selectedBatch.id} · ${
                selectedBatch.original_filename || "Sin archivo"
              }`
            : "Detalle de importación"}
        </DialogTitle>

        <DialogContent>
          {selectedBatch ? (
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                sx={{
                  justifyContent: "space-between",
                  alignItems: { xs: "flex-start", md: "center" },
                }}
              >
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                    <StatusChip
                      label={selectedBatch.batch_status_display}
                      status={selectedBatch.batch_status}
                      type="batch"
                    />

                    <Chip
                      label={
                        selectedBatch.target_display || selectedBatch.target
                      }
                      size="small"
                      variant="outlined"
                      sx={{
                        color: colors.modules.excel.main,
                        bgcolor: colors.modules.excel.soft,
                        borderColor: colors.modules.excel.border,
                        fontWeight: 850,
                      }}
                    />
                  </Stack>

                  <Typography variant="body2" sx={{ color: colors.text.muted }}>
                    Creado: {formatDateTime(selectedBatch.created_at)} · Tamaño:{" "}
                    {formatFileSize(selectedBatch.size_bytes)}
                  </Typography>

                  <Typography
                    variant="caption"
                    sx={{ color: colors.text.muted }}
                  >
                    SHA256: {selectedBatch.file_sha256 || "Sin hash"}
                  </Typography>
                </Stack>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button
                    variant="outlined"
                    disabled={
                      actionBatchId === selectedBatch.id ||
                      !["CREADO", "FALLIDO"].includes(
                        selectedBatch.batch_status,
                      )
                    }
                    onClick={() => void handlePrevalidate(selectedBatch)}
                  >
                    Prevalidar
                  </Button>

                  <Button
                    variant="contained"
                    disabled={
                      actionBatchId === selectedBatch.id ||
                      selectedBatch.batch_status !== "PREVALIDADO"
                    }
                    onClick={() => void handleProcess(selectedBatch)}
                  >
                    Procesar
                  </Button>
                </Stack>
              </Stack>

              {selectedBatch.notes ? (
                <Alert severity="info" variant="outlined">
                  {selectedBatch.notes}
                </Alert>
              ) : null}

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(3, minmax(0, 1fr))",
                    md: "repeat(6, minmax(0, 1fr))",
                  },
                  gap: 1.5,
                }}
              >
                {[
                  ["Total", selectedBatch.total_rows],
                  ["Válidas", selectedBatch.valid_rows],
                  ["Errores", selectedBatch.error_rows],
                  ["Duplicadas", selectedBatch.duplicate_rows],
                  ["Revisión", selectedBatch.review_rows],
                  ["Importadas", selectedBatch.imported_rows],
                ].map(([label, value]) => (
                  <Card
                    key={String(label)}
                    variant="outlined"
                    sx={{ borderColor: colors.border.light }}
                  >
                    <CardContent>
                      <Typography
                        variant="caption"
                        sx={{ color: colors.text.muted }}
                      >
                        {label}
                      </Typography>

                      <Typography
                        variant="h6"
                        sx={{ color: colors.text.primary, fontWeight: 950 }}
                      >
                        {formatNumber(Number(value || 0))}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>

              <Divider />

              <Box>
                <Typography
                  variant="h6"
                  sx={{ color: colors.text.primary, fontWeight: 900, mb: 1.5 }}
                >
                  Filas de la importación
                </Typography>

                <SmartDataGrid
                  rows={selectedBatchRows}
                  columns={rowColumns}
                  loading={refreshing}
                />
              </Box>

              {selectedBatchRows.length > 0 ? (
                <Box>
                  <Typography
                    variant="h6"
                    sx={{ color: colors.text.primary, fontWeight: 900, mb: 1 }}
                  >
                    Datos de la primera fila visible
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
                    {toReadableJson({
                      raw_data: selectedBatchRows[0].raw_data,
                      normalized_data: selectedBatchRows[0].normalized_data,
                      messages: selectedBatchRows[0].messages,
                    })}
                  </Box>
                </Box>
              ) : null}
            </Stack>
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
