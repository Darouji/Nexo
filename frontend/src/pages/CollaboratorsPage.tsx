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
import AddIcon from "@mui/icons-material/Add";
import BadgeIcon from "@mui/icons-material/Badge";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import GroupsIcon from "@mui/icons-material/Groups";
import LinkIcon from "@mui/icons-material/Link";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import type { GridColDef } from "@mui/x-data-grid";
import { SmartDataGrid } from "../components/SmartDataGrid";
import {
  createCollaborator,
  fetchCollaborators,
} from "../services/collaboratorService";
import type { Collaborator } from "../services/collaboratorService";
import { colors } from "../theme/colors";

type CollaboratorForm = {
  user: string;
  rut: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  shift: string;
  start_date: string;
  end_date: string;
  status: string;
  observations: string;
};

const emptyCollaboratorForm: CollaboratorForm = {
  user: "",
  rut: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  position: "",
  department: "",
  shift: "",
  start_date: "",
  end_date: "",
  status: "ACTIVO",
  observations: "",
};

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

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
  }).format(date);
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
        fontWeight: 850,
      }}
    />
  );
}

function LinkedUserChip({ collaborator }: { collaborator: Collaborator }) {
  const linked = Boolean(collaborator.user);

  return (
    <Chip
      label={linked ? collaborator.user_username || "Vinculado" : "Sin usuario"}
      size="small"
      variant="outlined"
      sx={{
        color: linked ? colors.primary.main : colors.text.muted,
        bgcolor: linked ? colors.primary.soft : colors.action.muted,
        borderColor: linked ? colors.primary.border : colors.border.medium,
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
              color: colors.modules.collaborators.main,
              bgcolor: colors.modules.collaborators.soft,
              border: `1px solid ${colors.modules.collaborators.border}`,
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

export function CollaboratorsPage() {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [selectedCollaborator, setSelectedCollaborator] =
    useState<Collaborator | null>(null);
  const [form, setForm] = useState<CollaboratorForm>(emptyCollaboratorForm);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [linkedFilter, setLinkedFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadCollaborators = useCallback(
    async (mode: "initial" | "refresh") => {
      try {
        if (mode === "initial") {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setErrorMessage("");

        const data = await fetchCollaborators({
          search: searchTerm,
          status: statusFilter || undefined,
          linked_user:
            linkedFilter === "linked"
              ? "true"
              : linkedFilter === "unlinked"
                ? "false"
                : undefined,
        });

        setCollaborators(data);
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
    [linkedFilter, searchTerm, statusFilter],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCollaborators("initial");
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadCollaborators]);

  const filteredCollaborators = useMemo(() => {
    const term = normalizeSearch(searchTerm.trim());

    if (!term) {
      return collaborators;
    }

    return collaborators.filter((collaborator) =>
      [
        collaborator.full_name,
        collaborator.rut,
        collaborator.email,
        collaborator.phone,
        collaborator.position,
        collaborator.department,
        collaborator.shift,
        collaborator.user_username,
        collaborator.user_email,
        collaborator.status,
        collaborator.status_display,
      ].some((value) => normalizeSearch(value).includes(term)),
    );
  }, [collaborators, searchTerm]);

  const departments = useMemo(() => {
    return Array.from(
      new Set(
        collaborators
          .map((collaborator) => collaborator.department)
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [collaborators]);

  const summary = useMemo(() => {
    const active = collaborators.filter(
      (collaborator) => collaborator.status === "ACTIVO",
    ).length;

    const linked = collaborators.filter(
      (collaborator) => collaborator.user,
    ).length;

    return {
      active,
      linked,
      unlinked: collaborators.length - linked,
      departments: departments.length,
    };
  }, [collaborators, departments.length]);

  const handleCreateCollaborator = useCallback(async () => {
    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      const created = await createCollaborator({
        user: form.user.trim() ? Number(form.user) : null,
        rut: form.rut.trim() || null,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        position: form.position.trim(),
        department: form.department.trim(),
        shift: form.shift.trim(),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: form.status,
        observations: form.observations.trim(),
      });

      setCollaborators((current) => [created, ...current]);
      setForm(emptyCollaboratorForm);
      setCreateDialogOpen(false);
      setSuccessMessage("Colaborador creado correctamente.");
      await loadCollaborators("refresh");
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }, [form, loadCollaborators]);

  const columns = useMemo<GridColDef[]>(() => {
    return [
      {
        field: "full_name",
        headerName: "Colaborador",
        minWidth: 230,
        flex: 1,
        renderCell: (params) => params.value || "Sin nombre",
      },
      {
        field: "rut",
        headerName: "RUT",
        width: 140,
        renderCell: (params) => params.value || "Sin RUT",
      },
      {
        field: "email",
        headerName: "Correo",
        minWidth: 210,
        flex: 0.8,
        renderCell: (params) => params.value || "Sin correo",
      },
      {
        field: "phone",
        headerName: "Teléfono",
        width: 145,
        renderCell: (params) => params.value || "Sin teléfono",
      },
      {
        field: "position",
        headerName: "Cargo",
        minWidth: 190,
        flex: 0.8,
        renderCell: (params) => params.value || "Sin cargo",
      },
      {
        field: "department",
        headerName: "Departamento",
        minWidth: 170,
        flex: 0.7,
        renderCell: (params) => params.value || "Sin departamento",
      },
      {
        field: "user_username",
        headerName: "Usuario vinculado",
        width: 170,
        renderCell: (params) => (
          <LinkedUserChip collaborator={params.row as Collaborator} />
        ),
      },
      {
        field: "start_date",
        headerName: "Ingreso",
        width: 145,
        renderCell: (params) => formatDate(String(params.value || "")),
      },
      {
        field: "status",
        headerName: "Estado",
        width: 135,
        renderCell: (params) => (
          <StatusChip status={String(params.value || "")} />
        ),
      },
      {
        field: "actions",
        headerName: "Acciones",
        width: 120,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Button
            size="small"
            variant="outlined"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedCollaborator(params.row as Collaborator);
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
          Cargando colaboradores...
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
              label="Personas internas"
              icon={<GroupsIcon />}
              variant="outlined"
              size="small"
              sx={{
                mb: 2,
                color: colors.modules.collaborators.main,
                bgcolor: colors.modules.collaborators.soft,
                borderColor: colors.modules.collaborators.border,
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
              Colaboradores
            </Typography>

            <Typography
              variant="h6"
              sx={{
                color: colors.text.secondary,
                maxWidth: 830,
                lineHeight: 1.5,
                fontWeight: 500,
              }}
            >
              Registro de personas internas de SERKAN. Un colaborador puede
              vincularse a un usuario, pero no hereda permisos por esa relación.
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              variant="outlined"
              startIcon={
                refreshing ? <CircularProgress size={18} /> : <RefreshIcon />
              }
              onClick={() => void loadCollaborators("refresh")}
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
              startIcon={<AddIcon />}
              onClick={() => {
                setErrorMessage("");
                setSuccessMessage("");
                setCreateDialogOpen(true);
              }}
            >
              Nuevo colaborador
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

      <Alert severity="info" variant="outlined">
        Crear un colaborador no crea usuario interno ni contacto externo. La
        vinculación a usuario es opcional y sirve solo para trazabilidad.
      </Alert>

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
          title="Colaboradores"
          value={formatNumber(collaborators.length)}
          helper={`${formatNumber(summary.active)} activos`}
          icon={<GroupsIcon />}
        />

        <SummaryCard
          title="Usuarios vinculados"
          value={formatNumber(summary.linked)}
          helper={`${formatNumber(summary.unlinked)} sin usuario`}
          icon={<LinkIcon />}
        />

        <SummaryCard
          title="Departamentos"
          value={formatNumber(summary.departments)}
          helper="Áreas internas registradas"
          icon={<BusinessCenterIcon />}
        />

        <SummaryCard
          title="Activos"
          value={formatNumber(summary.active)}
          helper="Colaboradores disponibles"
          icon={<BadgeIcon />}
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
              direction={{ xs: "column", lg: "row" }}
              spacing={2}
              sx={{
                alignItems: { xs: "stretch", lg: "center" },
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Typography
                  variant="h5"
                  sx={{ color: colors.text.primary, fontWeight: 900 }}
                >
                  Nómina interna
                </Typography>

                <Typography variant="body2" sx={{ color: colors.text.muted }}>
                  Busca por nombre, RUT, correo, cargo, departamento, teléfono o
                  usuario vinculado.
                </Typography>
              </Box>

              <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                <TextField
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar colaboradores..."
                  size="small"
                  sx={{ minWidth: { xs: "100%", md: 280 } }}
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
                  label="Estado"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  size="small"
                  sx={{ minWidth: { xs: "100%", md: 150 } }}
                >
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="ACTIVO">Activos</MenuItem>
                  <MenuItem value="INACTIVO">Inactivos</MenuItem>
                  <MenuItem value="ARCHIVADO">Archivados</MenuItem>
                </TextField>

                <TextField
                  select
                  label="Usuario"
                  value={linkedFilter}
                  onChange={(event) => setLinkedFilter(event.target.value)}
                  size="small"
                  sx={{ minWidth: { xs: "100%", md: 170 } }}
                >
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="linked">Vinculados</MenuItem>
                  <MenuItem value="unlinked">Sin usuario</MenuItem>
                </TextField>
              </Stack>
            </Stack>

            <SmartDataGrid
              rows={filteredCollaborators}
              columns={columns}
              loading={refreshing}
            />
          </Stack>
        </CardContent>
      </Card>

      <Dialog
        open={createDialogOpen}
        onClose={() => {
          if (!saving) {
            setCreateDialogOpen(false);
          }
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Nuevo colaborador</DialogTitle>

        <DialogContent>
          <Stack spacing={2.2} sx={{ mt: 1 }}>
            <Alert severity="info" variant="outlined">
              Este formulario solo crea la ficha del colaborador. No crea una
              cuenta de acceso ni modifica permisos.
            </Alert>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Nombres"
                value={form.first_name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    first_name: event.target.value,
                  }))
                }
                required
                fullWidth
              />

              <TextField
                label="Apellidos"
                value={form.last_name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    last_name: event.target.value,
                  }))
                }
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="RUT"
                value={form.rut}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    rut: event.target.value,
                  }))
                }
                fullWidth
              />

              <TextField
                label="ID usuario vinculado opcional"
                value={form.user}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    user: event.target.value,
                  }))
                }
                helperText="Solo si ya existe una cuenta de usuario interna."
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Correo"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                fullWidth
              />

              <TextField
                label="Teléfono"
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Cargo"
                value={form.position}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    position: event.target.value,
                  }))
                }
                fullWidth
              />

              <TextField
                label="Departamento"
                value={form.department}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    department: event.target.value,
                  }))
                }
                fullWidth
              />
            </Stack>

            <TextField
              label="Turno"
              value={form.shift}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  shift: event.target.value,
                }))
              }
              fullWidth
            />

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Fecha de ingreso"
                type="date"
                value={form.start_date}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    start_date: event.target.value,
                  }))
                }
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />

              <TextField
                label="Fecha de salida"
                type="date"
                value={form.end_date}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    end_date: event.target.value,
                  }))
                }
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />

              <TextField
                select
                label="Estado"
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
                fullWidth
              >
                <MenuItem value="ACTIVO">Activo</MenuItem>
                <MenuItem value="INACTIVO">Inactivo</MenuItem>
              </TextField>
            </Stack>

            <TextField
              label="Observaciones"
              value={form.observations}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  observations: event.target.value,
                }))
              }
              multiline
              minRows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} disabled={saving}>
            Cancelar
          </Button>

          <Button
            variant="contained"
            onClick={handleCreateCollaborator}
            disabled={saving || !form.first_name.trim()}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(selectedCollaborator)}
        onClose={() => setSelectedCollaborator(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {selectedCollaborator?.full_name || "Detalle del colaborador"}
        </DialogTitle>

        <DialogContent>
          {selectedCollaborator ? (
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ flexWrap: "wrap" }}
              >
                <StatusChip status={selectedCollaborator.status} />
                <LinkedUserChip collaborator={selectedCollaborator} />
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
                    RUT
                  </Typography>

                  <Typography sx={{ color: colors.text.primary }}>
                    {selectedCollaborator.rut || "Sin RUT"}
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: colors.text.secondary, fontWeight: 800 }}
                  >
                    Usuario vinculado
                  </Typography>

                  <Typography sx={{ color: colors.text.primary }}>
                    {selectedCollaborator.user_username || "Sin usuario"}
                  </Typography>

                  {selectedCollaborator.user_email ? (
                    <Typography
                      variant="caption"
                      sx={{ color: colors.text.muted }}
                    >
                      {selectedCollaborator.user_email}
                    </Typography>
                  ) : null}
                </Box>

                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: colors.text.secondary, fontWeight: 800 }}
                  >
                    Correo
                  </Typography>

                  <Typography sx={{ color: colors.text.primary }}>
                    {selectedCollaborator.email || "Sin correo"}
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: colors.text.secondary, fontWeight: 800 }}
                  >
                    Teléfono
                  </Typography>

                  <Typography sx={{ color: colors.text.primary }}>
                    {selectedCollaborator.phone || "Sin teléfono"}
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: colors.text.secondary, fontWeight: 800 }}
                  >
                    Cargo
                  </Typography>

                  <Typography sx={{ color: colors.text.primary }}>
                    {selectedCollaborator.position || "Sin cargo"}
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: colors.text.secondary, fontWeight: 800 }}
                  >
                    Departamento
                  </Typography>

                  <Typography sx={{ color: colors.text.primary }}>
                    {selectedCollaborator.department || "Sin departamento"}
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: colors.text.secondary, fontWeight: 800 }}
                  >
                    Fecha de ingreso
                  </Typography>

                  <Typography sx={{ color: colors.text.primary }}>
                    {formatDate(selectedCollaborator.start_date)}
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: colors.text.secondary, fontWeight: 800 }}
                  >
                    Fecha de salida
                  </Typography>

                  <Typography sx={{ color: colors.text.primary }}>
                    {formatDate(selectedCollaborator.end_date)}
                  </Typography>
                </Box>
              </Box>

              <Divider />

              <Box>
                <Typography
                  variant="body2"
                  sx={{ color: colors.text.secondary, fontWeight: 800 }}
                >
                  Observaciones
                </Typography>

                <Typography sx={{ color: colors.text.primary }}>
                  {selectedCollaborator.observations || "Sin observaciones"}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" sx={{ color: colors.text.muted }}>
                  Creado por{" "}
                  {selectedCollaborator.created_by_username || "sin usuario"} ·{" "}
                  {formatDateTime(selectedCollaborator.created_at)}
                </Typography>

                <Typography
                  variant="caption"
                  sx={{ color: colors.text.muted, display: "block" }}
                >
                  Última actualización por{" "}
                  {selectedCollaborator.updated_by_username || "sin usuario"} ·{" "}
                  {formatDateTime(selectedCollaborator.updated_at)}
                </Typography>
              </Box>
            </Stack>
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
