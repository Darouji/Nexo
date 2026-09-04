import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
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
import EditIcon from "@mui/icons-material/Edit";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { ProfileDocumentsSection } from "../components/ProfileDocumentsSection";
import { NexoDataGrid } from "../components/NexoDataGrid";
import { NexoFilterToolbar } from "../components/filters/NexoFilterToolbar";
import { NexoMultiSelectFilter } from "../components/filters/NexoMultiSelectFilter";
import { getApiErrorMessage as getErrorMessage, getApiFieldErrors } from "../services/api";
import {
  createCollaborator,
  fetchCollaborators,
  updateCollaborator,
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
  const [editingCollaborator, setEditingCollaborator] = useState<Collaborator | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [linkedFilter, setLinkedFilter] = useState<string[]>([]);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [filterResetKey, setFilterResetKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const loadCollaborators = useCallback(
    async (mode: "initial" | "refresh") => {
      try {
        if (mode === "initial") {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setErrorMessage("");

        const data = await fetchCollaborators();

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
    [],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCollaborators("initial");
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadCollaborators]);

  const filteredCollaborators = useMemo(() => {
    const term = normalizeSearch(searchTerm.trim());

    return collaborators.filter((collaborator) => {
      const matchesSearch = !term || [
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
      ].some((value) => normalizeSearch(value).includes(term));
      const matchesStatus = !statusFilter.length || statusFilter.includes(collaborator.status);
      const linkedValue = collaborator.user ? "linked" : "unlinked";
      const matchesLinked = !linkedFilter.length || linkedFilter.includes(linkedValue);
      return matchesSearch && matchesStatus && matchesLinked;
    });
  }, [collaborators, linkedFilter, searchTerm, statusFilter]);

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

  const openCollaboratorForm = (collaborator?: Collaborator) => {
    setEditingCollaborator(collaborator ?? null);
    setDialogError(""); setFieldErrors({}); setSuccessMessage("");
    setForm(collaborator ? {
      user: collaborator.user ? String(collaborator.user) : "", rut: collaborator.rut || "",
      first_name: collaborator.first_name, last_name: collaborator.last_name,
      email: collaborator.email, phone: collaborator.phone, position: collaborator.position,
      department: collaborator.department, shift: collaborator.shift,
      start_date: collaborator.start_date || "", end_date: collaborator.end_date || "",
      status: collaborator.status, observations: collaborator.observations,
    } : { ...emptyCollaboratorForm });
    setCreateDialogOpen(true);
  };

  const handleSaveCollaborator = useCallback(async () => {
    try {
      setSaving(true); setDialogError(""); setFieldErrors({}); setSuccessMessage("");
      const payload = {
        user: form.user.trim() ? Number(form.user) : null, rut: form.rut.trim() || null,
        first_name: form.first_name.trim(), last_name: form.last_name.trim(),
        email: form.email.trim(), phone: form.phone.trim(), position: form.position.trim(),
        department: form.department.trim(), shift: form.shift.trim(),
        start_date: form.start_date || null, end_date: form.end_date || null,
        status: form.status, observations: form.observations.trim(),
      };
      if (editingCollaborator) await updateCollaborator(editingCollaborator.id, payload);
      else await createCollaborator(payload);
      setForm({ ...emptyCollaboratorForm }); setCreateDialogOpen(false); setEditingCollaborator(null);
      setSuccessMessage(editingCollaborator ? "Colaborador actualizado correctamente." : "Colaborador creado correctamente.");
      await loadCollaborators("refresh");
    } catch (error: unknown) {
      setFieldErrors(getApiFieldErrors(error)); setDialogError(getErrorMessage(error));
    } finally { setSaving(false); }
  }, [editingCollaborator, form, loadCollaborators]);

  const columns = useMemo<ColDef<Collaborator>[]>(() => [
    { field: "full_name", headerName: "Colaborador", minWidth: 230, flex: 1, valueFormatter: (p) => String(p.value || "Sin nombre") },
    { field: "rut", headerName: "RUT", width: 145, valueFormatter: (p) => String(p.value || "Sin RUT") },
    { field: "email", headerName: "Correo", minWidth: 210, flex: 0.8, valueFormatter: (p) => String(p.value || "Sin correo") },
    { field: "phone", headerName: "Teléfono", width: 150, valueFormatter: (p) => String(p.value || "Sin teléfono") },
    { field: "position", headerName: "Cargo", minWidth: 185, flex: 0.7, valueFormatter: (p) => String(p.value || "Sin cargo") },
    { field: "department", headerName: "Departamento", minWidth: 175, flex: 0.7, valueFormatter: (p) => String(p.value || "Sin departamento") },
    { field: "shift", headerName: "Turno", minWidth: 160, valueFormatter: (p) => String(p.value || "Sin turno") },
    { field: "user_username", headerName: "Usuario vinculado", width: 175, cellRenderer: (p: ICellRendererParams<Collaborator>) => p.data ? <LinkedUserChip collaborator={p.data} /> : null },
    { field: "start_date", headerName: "Ingreso", width: 145, valueFormatter: (p) => formatDate(String(p.value || "")) },
    { field: "status", headerName: "Estado", width: 135, cellRenderer: (p: ICellRendererParams<Collaborator>) => <StatusChip status={String(p.value || "")} /> },
    { colId: "actions", headerName: "Acciones", width: 210, pinned: "right", sortable: false, filter: false,
      cellRenderer: (p: ICellRendererParams<Collaborator>) => p.data ? <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", height: "100%" }}>
        <Button size="small" variant="outlined" onClick={() => setSelectedCollaborator(p.data!)}>Ver</Button>
        <Button size="small" startIcon={<EditIcon />} onClick={() => openCollaboratorForm(p.data!)}>Editar</Button>
      </Stack> : null },
  ], []);

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
              Los colaboradores son personas que trabajan o han trabajado para NEXO, con o sin acceso a la plataforma. Sirve para registrar personal temporal, de apoyo o permanente; solo quienes necesiten usar el sistema requieren además una cuenta de usuario.
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
                openCollaboratorForm();
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
        Registrar un colaborador no crea acceso a la plataforma. Puedes usar esta ficha para personal temporal o permanente; vincula una cuenta de usuario solo cuando esa persona necesite ingresar al sistema.
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
            <Box>
              <Typography variant="h5" sx={{ color: colors.text.primary, fontWeight: 900 }}>
                Nómina interna
              </Typography>
              <Typography variant="body2" sx={{ color: colors.text.muted }}>
                Búsqueda, filtros múltiples, vistas personales y columnas configurables.
              </Typography>
            </Box>

            <NexoFilterToolbar
              searchLabel="Buscar colaboradores"
              searchPlaceholder="Nombre, RUT, correo, cargo, departamento, teléfono o usuario..."
              searchValue={searchTerm}
              onSearchValueChange={(value) => { setSearchTerm(value); setPagination((current) => ({ ...current, page: 0 })); }}
              onApply={() => setPagination((current) => ({ ...current, page: 0 }))}
              onClear={() => {
                setSearchTerm(""); setStatusFilter([]); setLinkedFilter([]);
                setPagination((current) => ({ ...current, page: 0 }));
                setFilterResetKey((current) => current + 1);
              }}
              loading={refreshing}
              expanded={filtersExpanded}
              onExpandedChange={setFiltersExpanded}
              activeFiltersCount={statusFilter.length + linkedFilter.length}
              panelId="collaborators-advanced-filters"
            >
              <NexoMultiSelectFilter label="Estado" options={[
                { value: "ACTIVO", label: "Activo" }, { value: "INACTIVO", label: "Inactivo" },
                { value: "ARCHIVADO", label: "Archivado" },
              ]} value={statusFilter} onChange={(value) => { setStatusFilter(value); setPagination((current) => ({ ...current, page: 0 })); }} />
              <NexoMultiSelectFilter label="Usuario vinculado" options={[
                { value: "linked", label: "Vinculado" }, { value: "unlinked", label: "Sin usuario" },
              ]} value={linkedFilter} onChange={(value) => { setLinkedFilter(value); setPagination((current) => ({ ...current, page: 0 })); }} />
            </NexoFilterToolbar>

            <NexoDataGrid
              gridKey="collaborators.collaborators" serverManaged clientManaged
              ariaLabel="Nómina interna de colaboradores"
              rows={filteredCollaborators} columns={columns} loading={refreshing}
              paginationModel={pagination} onPaginationModelChange={setPagination}
              rowCount={filteredCollaborators.length} filterResetKey={filterResetKey}
              namedViewFilters={{ search: searchTerm, status: statusFilter.join(","), linked_user: linkedFilter.join(",") }}
            />
          </Stack>
        </CardContent>
      </Card>

      <Dialog
        open={createDialogOpen}
        onClose={() => {
          if (!saving) {
            setCreateDialogOpen(false);
            setEditingCollaborator(null);
            setDialogError("");
            setFieldErrors({});
          }
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>{editingCollaborator ? "Editar colaborador" : "Nuevo colaborador"}</DialogTitle>

        <DialogContent>
          <Stack spacing={2.2} sx={{ mt: 1 }}>
            {dialogError ? <Alert severity="error" variant="outlined">{dialogError}</Alert> : null}
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
                error={Boolean(fieldErrors.first_name)}
                helperText={fieldErrors.first_name}
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
                error={Boolean(fieldErrors.user)}
                helperText={fieldErrors.user || "Solo si ya existe una cuenta de usuario interna."}
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
          <Button onClick={() => { setCreateDialogOpen(false); setEditingCollaborator(null); }} disabled={saving}>
            Cancelar
          </Button>

          <Button
            variant="contained"
            onClick={() => void handleSaveCollaborator()}
            disabled={saving || !form.first_name.trim()}
          >
            {saving ? "Guardando..." : editingCollaborator ? "Guardar cambios" : "Guardar"}
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

              <Divider />

              <ProfileDocumentsSection
                ownerKind="collaborator"
                ownerId={selectedCollaborator.id}
                ownerLabel={selectedCollaborator.full_name}
              />

              <Divider />

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
