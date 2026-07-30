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
  Stack,
  Typography,
} from "@mui/material";
import DescriptionIcon from "@mui/icons-material/Description";
import DownloadIcon from "@mui/icons-material/Download";
import FolderIcon from "@mui/icons-material/Folder";
import HistoryIcon from "@mui/icons-material/History";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import type { GridColDef } from "@mui/x-data-grid";
import { SmartDataGrid } from "../components/SmartDataGrid";
import { CreateDocumentDialog } from "../features/documents/CreateDocumentDialog";
import {
  fetchDocumentFiles,
  fetchDocumentVersions,
} from "../services/documentService";
import type {
  DocumentFile,
  DocumentVersion,
} from "../services/documentService";
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

  return "No se pudieron cargar los documentos.";
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

function StatusChip({ status }: { status: string }) {
  const isActive = status === "ACTIVO";

  return (
    <Chip
      label={status || "SIN ESTADO"}
      size="small"
      variant="outlined"
      sx={{
        color: isActive ? colors.status.success : colors.text.muted,
        bgcolor: isActive ? colors.status.successSoft : colors.action.muted,
        borderColor: isActive ? colors.status.success : colors.border.medium,
        fontWeight: 800,
      }}
    />
  );
}

function ActiveVersionChip({ version }: { version: DocumentVersion | null }) {
  if (!version) {
    return (
      <Chip
        label="Sin versión activa"
        size="small"
        variant="outlined"
        sx={{
          color: colors.text.muted,
          bgcolor: colors.action.muted,
          borderColor: colors.border.medium,
          fontWeight: 800,
        }}
      />
    );
  }

  return (
    <Chip
      label={`v${version.version_number}`}
      size="small"
      variant="outlined"
      sx={{
        color: colors.modules.documents.main,
        bgcolor: colors.modules.documents.soft,
        borderColor: colors.modules.documents.border,
        fontWeight: 900,
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
              color: colors.modules.documents.main,
              bgcolor: colors.modules.documents.soft,
              border: `1px solid ${colors.modules.documents.border}`,
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

export function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DocumentFile | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadDocuments = useCallback(async (mode: "initial" | "refresh") => {
    try {
      if (mode === "initial") {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setErrorMessage("");

      const [documentsData, versionsData] = await Promise.all([
        fetchDocumentFiles(),
        fetchDocumentVersions(),
      ]);

      setDocuments(documentsData);
      setVersions(versionsData);
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
      void loadDocuments("initial");
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadDocuments]);

  const filteredDocuments = useMemo(() => {
    const term = normalizeSearch(searchTerm.trim());

    if (!term) {
      return documents;
    }

    return documents.filter((document) =>
      [
        document.title,
        document.document_type,
        document.document_type_display,
        document.description,
        document.owner_repr,
        document.owner_content_type_label,
        document.active_version?.original_filename,
        document.active_version?.file_sha256,
        document.status,
      ].some((value) => normalizeSearch(value).includes(term)),
    );
  }, [documents, searchTerm]);

  const summary = useMemo(() => {
    const activeDocuments = documents.filter(
      (document) => document.status === "ACTIVO",
    ).length;

    const documentsWithActiveVersion = documents.filter(
      (document) => document.active_version,
    ).length;

    const totalBytes = versions.reduce(
      (total, version) => total + Number(version.size_bytes || 0),
      0,
    );

    return {
      activeDocuments,
      documentsWithActiveVersion,
      totalBytes,
      activeVersions: versions.filter((version) => version.is_active).length,
    };
  }, [documents, versions]);

  const columns = useMemo<GridColDef[]>(() => {
    return [
      {
        field: "title",
        headerName: "Documento",
        minWidth: 240,
        flex: 1,
      },
      {
        field: "document_type_display",
        headerName: "Tipo",
        minWidth: 160,
        flex: 0.7,
        renderCell: (params) => params.value || "Sin tipo",
      },
      {
        field: "owner_repr",
        headerName: "Registro asociado",
        minWidth: 230,
        flex: 1,
        renderCell: (params) => params.value || "Sin registro asociado",
      },
      {
        field: "active_version",
        headerName: "Versión activa",
        width: 145,
        sortable: false,
        renderCell: (params) => (
          <ActiveVersionChip
            version={(params.row as DocumentFile).active_version}
          />
        ),
      },
      {
        field: "active_filename",
        headerName: "Archivo activo",
        minWidth: 220,
        flex: 1,
        sortable: false,
        renderCell: (params) => {
          const document = params.row as DocumentFile;
          return document.active_version?.original_filename || "Sin archivo";
        },
      },
      {
        field: "updated_at",
        headerName: "Última actualización",
        width: 180,
        renderCell: (params) => formatDateTime(String(params.value || "")),
      },
      {
        field: "status",
        headerName: "Estado",
        width: 140,
        renderCell: (params) => (
          <StatusChip status={String(params.value || "")} />
        ),
      },
      {
        field: "actions",
        headerName: "Acciones",
        width: 190,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const document = params.row as DocumentFile;
          const fileUrl = document.active_version?.file_url || "";

          return (
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedDocument(document);
                }}
              >
                Ver
              </Button>

              <Button
                size="small"
                variant="text"
                startIcon={<DownloadIcon />}
                disabled={!fileUrl}
                onClick={(event) => {
                  event.stopPropagation();

                  if (fileUrl) {
                    window.open(fileUrl, "_blank", "noopener,noreferrer");
                  }
                }}
              >
                Abrir
              </Button>
            </Stack>
          );
        },
      },
    ];
  }, []);

  if (loading) {
    return (
      <Stack spacing={2} sx={{ alignItems: "center", py: 6 }}>
        <CircularProgress />
        <Typography sx={{ color: colors.text.secondary }}>
          Cargando documentos...
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
              label="Gestión documental"
              icon={<FolderIcon />}
              variant="outlined"
              size="small"
              sx={{
                mb: 2,
                color: colors.modules.documents.main,
                bgcolor: colors.modules.documents.soft,
                borderColor: colors.modules.documents.border,
                fontWeight: 800,
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
              Documentos
            </Typography>

            <Typography
              variant="h6"
              sx={{
                color: colors.text.secondary,
                maxWidth: 780,
                lineHeight: 1.5,
                fontWeight: 500,
              }}
            >
              Facturas, guías, HES, fichas y archivos asociados a registros del
              sistema, con historial de versiones y archivo activo.
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              variant="outlined"
              startIcon={
                refreshing ? <CircularProgress size={18} /> : <RefreshIcon />
              }
              onClick={() => void loadDocuments("refresh")}
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
              startIcon={<UploadFileIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Nuevo documento
            </Button>
          </Stack>
        </Stack>
      </Box>

      {errorMessage ? (
        <Alert severity="warning" variant="outlined">
          {errorMessage}
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
          title="Documentos"
          value={formatNumber(documents.length)}
          helper={`${formatNumber(summary.activeDocuments)} activos`}
          icon={<DescriptionIcon />}
        />

        <SummaryCard
          title="Con versión activa"
          value={formatNumber(summary.documentsWithActiveVersion)}
          helper="Documentos con archivo vigente"
          icon={<FolderIcon />}
        />

        <SummaryCard
          title="Versiones"
          value={formatNumber(versions.length)}
          helper={`${formatNumber(summary.activeVersions)} activas`}
          icon={<HistoryIcon />}
        />

        <SummaryCard
          title="Tamaño total"
          value={formatFileSize(summary.totalBytes)}
          helper="Peso acumulado de versiones"
          icon={<DownloadIcon />}
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
                  Biblioteca documental
                </Typography>

                <Typography variant="body2" sx={{ color: colors.text.muted }}>
                  Busca por título, tipo, registro asociado, archivo, hash o
                  estado.
                </Typography>
              </Box>

              <Box
                component="input"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar documentos..."
                style={{ display: "none" }}
              />

              <Typography
                component="div"
                sx={{
                  minWidth: { xs: "100%", md: 360 },
                }}
              >
                <InputAdornment position="start" sx={{ display: "none" }}>
                  <SearchIcon />
                </InputAdornment>

                <Box
                  component="label"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    px: 1.6,
                    py: 1.1,
                    border: `1px solid ${colors.border.medium}`,
                    borderRadius: colors.radius.md,
                    bgcolor: colors.background.paper,
                    color: colors.text.secondary,
                  }}
                >
                  <SearchIcon fontSize="small" />

                  <Box
                    component="input"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Buscar..."
                    sx={{
                      border: 0,
                      outline: 0,
                      bgcolor: "transparent",
                      color: colors.text.primary,
                      width: "100%",
                      font: "inherit",
                    }}
                  />
                </Box>
              </Typography>
            </Stack>

            <SmartDataGrid
              rows={filteredDocuments}
              columns={columns}
              loading={refreshing}
            />
          </Stack>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedDocument)}
        onClose={() => setSelectedDocument(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {selectedDocument?.title || "Detalle del documento"}
        </DialogTitle>

        <DialogContent>
          {selectedDocument ? (
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ flexWrap: "wrap" }}
              >
                <Chip
                  label={
                    selectedDocument.document_type_display ||
                    selectedDocument.document_type
                  }
                  size="small"
                  sx={{
                    color: colors.modules.documents.main,
                    bgcolor: colors.modules.documents.soft,
                    borderColor: colors.modules.documents.border,
                    fontWeight: 800,
                  }}
                  variant="outlined"
                />

                <StatusChip status={selectedDocument.status} />

                <ActiveVersionChip version={selectedDocument.active_version} />
              </Stack>

              <Box>
                <Typography
                  variant="body2"
                  sx={{ color: colors.text.secondary, fontWeight: 800 }}
                >
                  Registro asociado
                </Typography>

                <Typography sx={{ color: colors.text.primary }}>
                  {selectedDocument.owner_repr || "Sin registro asociado"}
                </Typography>

                <Typography variant="caption" sx={{ color: colors.text.muted }}>
                  {selectedDocument.owner_content_type_label} · ID{" "}
                  {selectedDocument.owner_object_id}
                </Typography>
              </Box>

              {selectedDocument.description ? (
                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: colors.text.secondary, fontWeight: 800 }}
                  >
                    Descripción
                  </Typography>

                  <Typography sx={{ color: colors.text.primary }}>
                    {selectedDocument.description}
                  </Typography>
                </Box>
              ) : null}

              <Divider />

              <Box>
                <Typography
                  variant="h6"
                  sx={{ color: colors.text.primary, fontWeight: 900, mb: 1.5 }}
                >
                  Historial de versiones
                </Typography>

                <Stack spacing={1.5}>
                  {(selectedDocument.versions ?? []).length === 0 ? (
                    <Alert severity="info" variant="outlined">
                      Este documento no tiene versiones registradas.
                    </Alert>
                  ) : (
                    selectedDocument.versions.map((version) => (
                      <Card
                        key={version.id}
                        variant="outlined"
                        sx={{
                          borderColor: version.is_active
                            ? colors.modules.documents.border
                            : colors.border.light,
                          bgcolor: version.is_active
                            ? colors.modules.documents.soft
                            : colors.background.paper,
                        }}
                      >
                        <CardContent>
                          <Stack
                            direction={{ xs: "column", md: "row" }}
                            spacing={2}
                            sx={{
                              alignItems: { xs: "flex-start", md: "center" },
                              justifyContent: "space-between",
                            }}
                          >
                            <Box>
                              <Stack
                                direction="row"
                                spacing={1}
                                sx={{ alignItems: "center", mb: 0.8 }}
                              >
                                <Typography
                                  sx={{
                                    color: colors.text.primary,
                                    fontWeight: 900,
                                  }}
                                >
                                  Versión {version.version_number}
                                </Typography>

                                {version.is_active ? (
                                  <Chip
                                    label="Activa"
                                    size="small"
                                    sx={{
                                      color: colors.status.success,
                                      bgcolor: colors.status.successSoft,
                                      fontWeight: 800,
                                    }}
                                  />
                                ) : null}
                              </Stack>

                              <Typography
                                variant="body2"
                                sx={{ color: colors.text.secondary }}
                              >
                                {version.original_filename || "Sin nombre"} ·{" "}
                                {formatFileSize(version.size_bytes)}
                              </Typography>

                              <Typography
                                variant="caption"
                                sx={{ color: colors.text.muted }}
                              >
                                Subido por{" "}
                                {version.uploaded_by_name || "sin usuario"} ·{" "}
                                {formatDateTime(version.created_at)}
                              </Typography>

                              {version.replace_reason ? (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: colors.text.muted,
                                    display: "block",
                                    mt: 0.7,
                                  }}
                                >
                                  Motivo de reemplazo: {version.replace_reason}
                                </Typography>
                              ) : null}
                            </Box>

                            <Button
                              variant="outlined"
                              startIcon={<DownloadIcon />}
                              disabled={!version.file_url}
                              onClick={() => {
                                if (version.file_url) {
                                  window.open(
                                    version.file_url,
                                    "_blank",
                                    "noopener,noreferrer",
                                  );
                                }
                              }}
                            >
                              Abrir archivo
                            </Button>
                          </Stack>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </Stack>
              </Box>
            </Stack>
          ) : null}
        </DialogContent>
      </Dialog>

      <CreateDocumentDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreated={() => void loadDocuments("refresh")}
      />
    </Stack>
  );
}
