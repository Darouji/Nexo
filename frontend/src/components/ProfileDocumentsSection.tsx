import { useCallback, useEffect, useMemo, useState } from "react";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { getApiErrorMessage } from "../services/api";
import {
  createDocumentFile,
  fetchDocumentFiles,
  fetchDocumentOwnerTypes,
  type DocumentFile,
  type DocumentType,
} from "../services/documentService";
import { colors } from "../theme/colors";

type OwnerKind = "user" | "collaborator";

type Props = {
  ownerKind: OwnerKind;
  ownerId: number;
  ownerLabel: string;
};

const OWNER_META = {
  user: { app: "accounts", model: "user" },
  collaborator: { app: "collaborators", model: "collaborator" },
} as const;

const DOCUMENT_TYPES: Array<{ value: DocumentType; label: string }> = [
  { value: "CONTRATO", label: "Contrato" },
  { value: "ANEXO", label: "Anexo de contrato" },
  { value: "CERTIFICADO", label: "Certificado" },
  { value: "OTRO", label: "Otro" },
];

export function ProfileDocumentsSection({
  ownerKind,
  ownerId,
  ownerLabel,
}: Props) {
  const meta = OWNER_META[ownerKind];
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [ownerTypeId, setOwnerTypeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] =
    useState<DocumentType>("CONTRATO");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const loadDocuments = useCallback(async () => {
    try {
      const [rows, ownerTypes] = await Promise.all([
        fetchDocumentFiles({
          owner_app: meta.app,
          owner_model: meta.model,
          owner_object_id: ownerId,
          ordering: "-created_at",
        }),
        fetchDocumentOwnerTypes(),
      ]);
      setDocuments(rows);
      setOwnerTypeId(
        ownerTypes.find(
          (item) =>
            item.app_label === meta.app && item.model === meta.model,
        )?.id ?? null,
      );
    } catch (reason: unknown) {
      setError(
        getApiErrorMessage(reason, "No se pudieron cargar los documentos."),
      );
    } finally {
      setLoading(false);
    }
  }, [meta.app, meta.model, ownerId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDocuments();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadDocuments]);

  const activeCount = useMemo(
    () => documents.filter((item) => item.active_version).length,
    [documents],
  );

  const resetDialog = () => {
    setDialogOpen(false);
    setTitle("");
    setDocumentType("CONTRATO");
    setDescription("");
    setFile(null);
    setError("");
  };

  const closeDialog = () => {
    if (!saving) resetDialog();
  };

  const saveDocument = async () => {
    if (!ownerTypeId || !file || !title.trim()) {
      setError("Indica el título y selecciona un archivo.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      await createDocumentFile({
        title,
        document_type: documentType,
        description,
        owner_content_type: ownerTypeId,
        owner_object_id: ownerId,
        file,
      });
      resetDialog();
      await loadDocuments();
    } catch (reason: unknown) {
      setError(
        getApiErrorMessage(reason, "No se pudo guardar el documento."),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{
          justifyContent: "space-between",
          alignItems: { xs: "stretch", sm: "center" },
          mb: 1.5,
        }}
      >
        <Box>
          <Typography sx={{ fontWeight: 900 }}>
            Documentos laborales
          </Typography>
          <Typography variant="body2" sx={{ color: colors.text.muted }}>
            {loading
              ? "Cargando..."
              : documents.length
                ? `${documents.length} documento(s), ${activeCount} con archivo vigente.`
                : "Aún no hay contratos, anexos u otros documentos registrados."}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<UploadFileIcon />}
          onClick={() => setDialogOpen(true)}
        >
          Agregar documento
        </Button>
      </Stack>

      {error && !dialogOpen ? (
        <Alert severity="error" variant="outlined" sx={{ mb: 1.5 }}>
          {error}
        </Alert>
      ) : null}

      <Stack spacing={1}>
        {documents.map((document) => (
          <Stack
            key={document.id}
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{
              p: 1.25,
              border: `1px solid ${colors.border.light}`,
              borderRadius: colors.radius.md,
              alignItems: { xs: "stretch", sm: "center" },
            }}
          >
            <AttachFileIcon sx={{ color: colors.text.muted }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800 }}>
                {document.title}
              </Typography>
              <Typography variant="caption" sx={{ color: colors.text.muted }}>
                {document.document_type_display} ·{" "}
                {document.active_version?.original_filename ||
                  "Sin archivo vigente"}
              </Typography>
            </Box>
            <Chip
              size="small"
              label={document.active_version ? "Vigente" : "Sin archivo"}
              color={document.active_version ? "success" : "default"}
              variant="outlined"
            />
            <Button
              size="small"
              startIcon={<OpenInNewIcon />}
              disabled={!document.active_version?.file_url}
              onClick={() => {
                const url = document.active_version?.file_url;
                if (url) window.open(url, "_blank", "noopener,noreferrer");
              }}
            >
              Abrir
            </Button>
          </Stack>
        ))}
      </Stack>

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Agregar documento a {ownerLabel}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error ? (
              <Alert severity="error" variant="outlined">
                {error}
              </Alert>
            ) : null}
            <TextField
              label="Título"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              helperText="Ejemplo: Contrato de trabajo 2026"
            />
            <TextField
              select
              label="Tipo de documento"
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
            >
              {DOCUMENT_TYPES.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Descripción"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              multiline
              minRows={2}
            />
            <Button
              component="label"
              variant="outlined"
              startIcon={<AttachFileIcon />}
            >
              {file ? file.name : "Seleccionar archivo"}
              <input
                hidden
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp"
                onChange={(event) =>
                  setFile(event.target.files?.[0] ?? null)
                }
              />
            </Button>
            <Typography variant="caption" sx={{ color: colors.text.muted }}>
              Formatos permitidos: PDF, Word, Excel, texto e imágenes. Máximo
              25 MB.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={() => void saveDocument()}
            disabled={saving || !title.trim() || !file}
          >
            {saving ? "Guardando..." : "Guardar documento"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
