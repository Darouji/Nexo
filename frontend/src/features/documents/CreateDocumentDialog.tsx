import { useCallback, useEffect, useState } from "react";
import {
  Alert,
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
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { getApiErrorMessage } from "../../services/api";
import {
  createDocumentFile,
  fetchDocumentOwnerOptions,
  fetchDocumentOwnerTypes,
  type DocumentOwnerOption,
  type DocumentOwnerType,
  type DocumentType,
} from "../../services/documentService";
import { colors } from "../../theme/colors";

const documentTypes: Array<{ value: DocumentType; label: string }> = [
  { value: "FACTURA", label: "Factura" },
  { value: "GUIA_DESPACHO", label: "Guía de despacho" },
  { value: "HES", label: "HES" },
  { value: "FICHA_PRODUCTO", label: "Ficha de producto" },
  { value: "CONTRATO", label: "Contrato" },
  { value: "ANEXO", label: "Anexo de contrato" },
  { value: "CERTIFICADO", label: "Certificado" },
  { value: "OTRO", label: "Otro" },
];

export function CreateDocumentDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [ownerTypes, setOwnerTypes] = useState<DocumentOwnerType[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<DocumentOwnerOption[]>([]);
  const [ownerTypeId, setOwnerTypeId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [documentType, setDocumentType] = useState<DocumentType>("FACTURA");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadOwnerTypes = useCallback(async () => {
    try {
      const rows = await fetchDocumentOwnerTypes();
      setOwnerTypes(rows);
    } catch (reason: unknown) {
      setError(getApiErrorMessage(reason, "No se pudieron cargar los tipos de registro."));
    }
  }, []);

  const loadOwnerOptions = useCallback(async (contentTypeId: number) => {
    try {
      setLoadingOptions(true);
      const rows = await fetchDocumentOwnerOptions(contentTypeId);
      setOwnerOptions(rows);
    } catch (reason: unknown) {
      setOwnerOptions([]);
      setError(getApiErrorMessage(reason, "No se pudieron cargar los registros asociados."));
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timeoutId = window.setTimeout(() => void loadOwnerTypes(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadOwnerTypes, open]);

  const reset = () => {
    setOwnerTypeId("");
    setOwnerId("");
    setOwnerOptions([]);
    setDocumentType("FACTURA");
    setTitle("");
    setDescription("");
    setFile(null);
    setError("");
  };

  const close = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const save = async () => {
    if (!ownerTypeId || !ownerId || !title.trim() || !file) {
      setError("Completa el tipo de registro, registro asociado, título y archivo.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      await createDocumentFile({
        title,
        document_type: documentType,
        description,
        owner_content_type: Number(ownerTypeId),
        owner_object_id: ownerId,
        file,
      });
      reset();
      onCreated();
      onClose();
    } catch (reason: unknown) {
      setError(getApiErrorMessage(reason, "No se pudo guardar el documento."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>Nuevo documento asociado</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error ? <Alert severity="error" variant="outlined">{error}</Alert> : null}
          <Typography variant="body2" sx={{ color: colors.text.secondary }}>
            Vincula el archivo a una venta, orden de compra, producto o perfil para mantener su trazabilidad.
          </Typography>
          <TextField
            select
            label="Tipo de registro asociado"
            value={ownerTypeId}
            onChange={(event) => {
              const value = event.target.value;
              setOwnerTypeId(value);
              setOwnerId("");
              setOwnerOptions([]);
              if (value) void loadOwnerOptions(Number(value));
            }}
            required
          >
            {ownerTypes.map((type) => (
              <MenuItem key={type.id} value={String(type.id)}>{type.label}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Registro asociado"
            value={ownerId}
            onChange={(event) => setOwnerId(event.target.value)}
            disabled={!ownerTypeId || loadingOptions}
            helperText={loadingOptions ? "Cargando registros..." : "Selecciona el registro al que pertenece el archivo."}
            required
          >
            {ownerOptions.map((option) => (
              <MenuItem key={option.id} value={String(option.id)}>{option.label}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Tipo de documento"
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value)}
          >
            {documentTypes.map((type) => (
              <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
            ))}
          </TextField>
          <TextField label="Título" value={title} onChange={(event) => setTitle(event.target.value)} required />
          <TextField label="Descripción" value={description} onChange={(event) => setDescription(event.target.value)} multiline minRows={2} />
          <Button component="label" variant="outlined" startIcon={<AttachFileIcon />}>
            {file?.name || "Seleccionar archivo"}
            <input
              hidden
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </Button>
          <Typography variant="caption" sx={{ color: colors.text.muted }}>
            PDF, Word, Excel, texto o imágenes. Máximo 25 MB.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={saving}>Cancelar</Button>
        <Button variant="contained" onClick={() => void save()} disabled={saving || !ownerId || !title.trim() || !file}>
          {saving ? "Guardando..." : "Guardar documento"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
