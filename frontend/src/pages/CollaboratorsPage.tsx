import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
} from "@mui/material";
import {
  createCollaborator,
  getCollaborators,
  updateCollaborator,
} from "../services/collaboratorService";
import type {
  Collaborator,
  CollaboratorPayload,
  CollaboratorStatus,
} from "../types/collaborator";
import AddIcon from "@mui/icons-material/Add";

const initialForm: CollaboratorPayload = {
  rut: "",
  first_name: "",
  last_name: "",
  position: "",
  area: "",
  email: "",
  phone: "",
  shift: "",
  status: "ACTIVO",
  observations: "",
};

const statusOptions: { value: CollaboratorStatus; label: string }[] = [
  { value: "ACTIVO", label: "Activo" },
  { value: "INACTIVO", label: "Inactivo" },
  { value: "SUSPENDIDO", label: "Suspendido" },
];

export function CollaboratorsPage() {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [form, setForm] = useState<CollaboratorPayload>(initialForm);
  const [saving, setSaving] = useState(false);
  const [editingCollaboratorId, setEditingCollaboratorId] = useState<number | null>(null);
  

function handleOpenCreateDialog() {
  setEditingCollaboratorId(null);
  setForm(initialForm);
  setOpenCreateDialog(true);
}

function handleCloseCreateDialog() {
  if (saving) return;

  setOpenCreateDialog(false);
  setEditingCollaboratorId(null);
}

function handleFormChange(
  field: keyof CollaboratorPayload,
  value: string
) {
  setForm((currentForm) => ({
    ...currentForm,
    [field]: value,
  }));
}

function handleOpenEditDialog(collaborator: Collaborator) {
  setEditingCollaboratorId(collaborator.id);

  setForm({
    rut: collaborator.rut || "",
    first_name: collaborator.first_name,
    last_name: collaborator.last_name,
    position: collaborator.position || "",
    area: collaborator.area || "",
    email: collaborator.email || "",
    phone: collaborator.phone || "",
    shift: collaborator.shift || "",
    status: collaborator.status,
    observations: collaborator.observations || "",
  });

  setOpenCreateDialog(true);
}

async function handleSaveCollaborator(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();

  try {
    setSaving(true);
    setError("");

    const payload = {
      ...form,
      rut: form.rut || null,
    };

    if (editingCollaboratorId) {
      await updateCollaborator(editingCollaboratorId, payload);
    } else {
      await createCollaborator(payload);
    }

    setOpenCreateDialog(false);
    setEditingCollaboratorId(null);
    setForm(initialForm);

    await loadCollaborators(search);
  } catch {
    setError(
      editingCollaboratorId
        ? "No se pudo actualizar el colaborador."
        : "No se pudo crear el colaborador."
    );
  } finally {
    setSaving(false);
  }
}

  async function loadCollaborators(searchValue = "") {
    try {
      setLoading(true);
      setError("");

      const data = await getCollaborators({
        search: searchValue || undefined,
      });

      setCollaborators(data);
    } catch {
      setError("No se pudieron cargar los colaboradores.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
  let isMounted = true;

  async function loadInitialCollaborators() {
    try {
      const data = await getCollaborators();

      if (isMounted) {
        setCollaborators(data);
      }
    } catch {
      if (isMounted) {
        setError("No se pudieron cargar los colaboradores.");
      }
    } finally {
      if (isMounted) {
        setLoading(false);
      }
    }
  }

  loadInitialCollaborators();

  return () => {
    isMounted = false;
  };
}, []);

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loadCollaborators(search);
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          Colaboradores
        </Typography>

        <Typography color="text.secondary">
          Personas internas de Serkan asociadas a cargos, áreas, usuarios,
          activos, chips, documentos y rendiciones.
        </Typography>
      </Box>

      <Card elevation={0}>
        <CardContent>
          <Stack
            component="form"
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            onSubmit={handleSearchSubmit}
          >
            <TextField
              fullWidth
              label="Buscar colaborador"
              placeholder="Nombre, RUT, correo, cargo o área"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <Button type="submit" variant="contained">
              Buscar
            </Button>

            <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleOpenCreateDialog}
                >
                Nuevo colaborador
                </Button>
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={2}>
          {collaborators.length === 0 ? (
            <Alert severity="info">No hay colaboradores registrados.</Alert>
          ) : (
            collaborators.map((collaborator) => (
              <Card key={collaborator.id} elevation={0}>
                <CardContent>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={2}
                    sx={{ justifyContent: "space-between" }}
                    >
                    <Box>
                      <Typography variant="h6">
                        {collaborator.full_name}
                      </Typography>

                      <Typography color="text.secondary">
                        {collaborator.position || "Sin cargo"} ·{" "}
                        {collaborator.area || "Sin área"}
                      </Typography>

                      <Typography variant="body2" color="text.secondary">
                        {collaborator.email || "Sin correo"} ·{" "}
                        {collaborator.phone || "Sin teléfono"}
                      </Typography>

                      {collaborator.rut && (
                        <Typography variant="body2" color="text.secondary">
                          RUT: {collaborator.rut}
                        </Typography>
                      )}
                    </Box>

                    <Box>
                        <Stack spacing={1} sx={{ alignItems: { xs: "flex-start", md: "flex-end" } }}>
                            <Chip
                            label={collaborator.status}
                            color={collaborator.status === "ACTIVO" ? "success" : "default"}
                            variant="outlined"
                            />

                            <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleOpenEditDialog(collaborator)}
                            >
                            Editar
                            </Button>
                        </Stack>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            ))
          )}
        </Stack>
      )}
      <Dialog
  open={openCreateDialog}
  onClose={handleCloseCreateDialog}
  fullWidth
  maxWidth="md"
>
  <Box component="form" onSubmit={handleSaveCollaborator}>
    <DialogTitle>
        {editingCollaboratorId ? "Editar colaborador" : "Nuevo colaborador"}
    </DialogTitle>

    <DialogContent>
      <Stack spacing={2} sx={{ mt: 1 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField
            fullWidth
            required
            label="Nombres"
            value={form.first_name}
            onChange={(event) =>
              handleFormChange("first_name", event.target.value)
            }
          />

          <TextField
            fullWidth
            required
            label="Apellidos"
            value={form.last_name}
            onChange={(event) =>
              handleFormChange("last_name", event.target.value)
            }
          />
        </Stack>

        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField
            fullWidth
            label="RUT"
            value={form.rut || ""}
            onChange={(event) => handleFormChange("rut", event.target.value)}
          />

          <TextField
            fullWidth
            label="Correo"
            type="email"
            value={form.email || ""}
            onChange={(event) => handleFormChange("email", event.target.value)}
          />
        </Stack>

        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField
            fullWidth
            label="Teléfono"
            value={form.phone || ""}
            onChange={(event) => handleFormChange("phone", event.target.value)}
          />

          <TextField
            fullWidth
            label="Turno"
            value={form.shift || ""}
            onChange={(event) => handleFormChange("shift", event.target.value)}
          />
        </Stack>

        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField
            fullWidth
            label="Cargo"
            value={form.position || ""}
            onChange={(event) =>
              handleFormChange("position", event.target.value)
            }
          />

          <TextField
            fullWidth
            label="Área"
            value={form.area || ""}
            onChange={(event) => handleFormChange("area", event.target.value)}
          />
        </Stack>

        <TextField
          select
          fullWidth
          label="Estado"
          value={form.status}
          onChange={(event) =>
            handleFormChange("status", event.target.value)
          }
        >
          {statusOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          fullWidth
          multiline
          minRows={3}
          label="Observaciones"
          value={form.observations || ""}
          onChange={(event) =>
            handleFormChange("observations", event.target.value)
          }
        />
      </Stack>
    </DialogContent>

    <DialogActions>
      <Button onClick={handleCloseCreateDialog} disabled={saving}>
        Cancelar
      </Button>

      <Button type="submit" variant="contained" disabled={saving}>
        {saving ? "Guardando..." : "Guardar"}
      </Button>
    </DialogActions>
  </Box>
</Dialog>
    </Stack>
  );
}