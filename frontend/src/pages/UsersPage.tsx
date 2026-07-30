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
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import BadgeIcon from "@mui/icons-material/Badge";
import LockIcon from "@mui/icons-material/Lock";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import RefreshIcon from "@mui/icons-material/Refresh";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { ProfileDocumentsSection } from "../components/ProfileDocumentsSection";
import { SerkanDataGrid, type SerkanGridFilter, type SerkanGridSortModel } from "../components/SerkanDataGrid";
import { SerkanFilterToolbar } from "../components/filters/SerkanFilterToolbar";
import { SerkanMultiSelectFilter } from "../components/filters/SerkanMultiSelectFilter";
import { createUser, fetchUsers, updateUser } from "../services/userService";
import type { CreateUserPayload } from "../services/userService";
import type { AuthUser } from "../types/auth";
import { colors } from "../theme/colors";

type UsersPageProps = {
  currentUser: AuthUser | null;
};

type UserForm = {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  password_confirm: string;
  role: string;
  phone: string;
  position: string;
  department: string;
  observations: string;
  status: string;
};

type RoleOption = {
  value: string;
  label: string;
  onlyAdmin: boolean;
};

const roleOptions: RoleOption[] = [
  { value: "ADMINISTRADOR", label: "Administrador", onlyAdmin: true },
  { value: "RRHH", label: "RRHH", onlyAdmin: false },
  { value: "INFORMATICO", label: "Informático", onlyAdmin: false },
  {
    value: "FINANZAS_COMERCIAL",
    label: "Finanzas / Comercial",
    onlyAdmin: false,
  },
  { value: "OPERATIVO", label: "Operativo", onlyAdmin: false },
  { value: "CONSULTA", label: "Consulta", onlyAdmin: false },
];

const emptyUserForm: UserForm = {
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  password: "",
  password_confirm: "",
  role: "OPERATIVO",
  phone: "",
  position: "",
  department: "",
  observations: "",
  status: "ACTIVO",
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

function StatusChip({ user }: { user: AuthUser }) {
  const isActive = user.is_active && user.status === "ACTIVO";

  return (
    <Chip
      label={
        isActive
          ? user.status_display || "Activo"
          : user.status_display || user.status
      }
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

function RoleChip({ user }: { user: AuthUser }) {
  const isAdmin = user.role === "ADMINISTRADOR";

  return (
    <Chip
      label={user.role_display || user.role}
      size="small"
      variant="outlined"
      sx={{
        color: isAdmin ? colors.status.warning : colors.primary.main,
        bgcolor: isAdmin ? colors.status.warningSoft : colors.primary.soft,
        borderColor: isAdmin ? colors.secondary.border : colors.primary.border,
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

export function UsersPage({ currentUser }: UsersPageProps) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AuthUser | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState<UserForm>(emptyUserForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [sortModel, setSortModel] = useState<SerkanGridSortModel>(null);
  const [columnFilters, setColumnFilters] = useState<SerkanGridFilter[]>([]);
  const [filterResetKey, setFilterResetKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const canCreateAdmin = currentUser?.role === "ADMINISTRADOR";

  const availableRoles = roleOptions.filter((role) => {
    if (role.onlyAdmin) {
      return canCreateAdmin || editingUser?.role === role.value;
    }

    return true;
  });

  const loadUsers = useCallback(async (mode: "initial" | "refresh") => {
    try {
      if (mode === "initial") {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setErrorMessage("");

      const data = await fetchUsers();
      setUsers(data);
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
      void loadUsers("initial");
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const term = normalizeSearch(searchTerm.trim());

    return users.filter((user) => {
      const matchesSearch = term
        ? [
            user.username,
            user.email,
            user.first_name,
            user.last_name,
            user.full_name,
            user.role,
            user.role_display,
            user.status,
            user.status_display,
            user.phone,
            user.position,
            user.department,
          ].some((value) => normalizeSearch(value).includes(term))
        : true;

      const matchesRole = roleFilter.length ? roleFilter.includes(user.role) : true;
      const matchesStatus = statusFilter.length ? statusFilter.includes(user.status) : true;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [roleFilter, searchTerm, statusFilter, users]);

  const summary = useMemo(() => {
    const active = users.filter(
      (user) => user.is_active && user.status === "ACTIVO",
    ).length;

    const admins = users.filter((user) => user.role === "ADMINISTRADOR").length;
    const staff = users.filter((user) => user.is_staff).length;

    return {
      active,
      inactive: users.length - active,
      admins,
      staff,
    };
  }, [users]);

  const updateFormField = (field: keyof UserForm, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const openUserForm = (user?: AuthUser) => {
    setFormError("");
    setErrorMessage("");
    setSuccessMessage("");
    setEditingUser(user ?? null);
    setForm(
      user
        ? {
            username: user.username,
            email: user.email || "",
            first_name: user.first_name || "",
            last_name: user.last_name || "",
            password: "",
            password_confirm: "",
            role: user.role,
            phone: user.phone || "",
            position: user.position || "",
            department: user.department || "",
            observations: user.observations || "",
            status: user.status || "ACTIVO",
          }
        : emptyUserForm,
    );
    setCreateDialogOpen(true);
  };

  const closeUserForm = () => {
    if (saving) return;
    setCreateDialogOpen(false);
    setEditingUser(null);
    setForm(emptyUserForm);
    setFormError("");
  };

  const handleSaveUser = useCallback(async () => {
    try {
      setSaving(true);
      setFormError("");
      setErrorMessage("");
      setSuccessMessage("");

      if (editingUser) {
        const updatedUser = await updateUser(editingUser.id, {
          email: form.email.trim() || null,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          role:
            canCreateAdmin || editingUser.role !== "ADMINISTRADOR"
              ? form.role
              : undefined,
          status: form.status,
          is_active: form.status === "ACTIVO",
          phone: form.phone.trim(),
          position: form.position.trim(),
          department: form.department.trim(),
          observations: form.observations.trim(),
        });
        setUsers((current) =>
          current.map((user) => (user.id === updatedUser.id ? updatedUser : user)),
        );
        setSuccessMessage("Usuario actualizado correctamente.");
      } else {
        const payload: CreateUserPayload = {
          username: form.username.trim(),
          email: form.email.trim() || null,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          password: form.password,
          password_confirm: form.password_confirm,
          role: form.role,
          phone: form.phone.trim(),
          position: form.position.trim(),
          department: form.department.trim(),
          observations: form.observations.trim(),
        };
        const response = await createUser(payload);
        setUsers((current) => [response.user, ...current]);
        setSuccessMessage(response.detail || "Usuario creado correctamente.");
      }

      setForm(emptyUserForm);
      setEditingUser(null);
      setCreateDialogOpen(false);
      await loadUsers("refresh");
    } catch (error: unknown) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }, [canCreateAdmin, editingUser, form, loadUsers]);
  const columns = useMemo<ColDef<AuthUser>[]>(() => {
    return [
      {
        field: "username",
        headerName: "Usuario",
        minWidth: 170,
        flex: 0.7,
      },
      {
        field: "full_name",
        headerName: "Nombre",
        minWidth: 220,
        flex: 1,
        cellRenderer: (params: ICellRendererParams<AuthUser>) => {
          const user = params.data;
          if (!user) return "-";
          return (
            user.full_name ||
            `${user.first_name} ${user.last_name}`.trim() ||
            "-"
          );
        },
      },
      {
        field: "email",
        headerName: "Correo",
        minWidth: 220,
        flex: 1,
        valueFormatter: (params) => String(params.value || "Sin correo"),
      },
      {
        field: "role",
        headerName: "Rol",
        minWidth: 180,
        flex: 0.7,
        cellRenderer: (params: ICellRendererParams<AuthUser>) => params.data ? <RoleChip user={params.data} /> : null,
      },
      {
        field: "status",
        headerName: "Estado",
        width: 145,
        cellRenderer: (params: ICellRendererParams<AuthUser>) => params.data ? <StatusChip user={params.data} /> : null,
      },
      {
        field: "position",
        headerName: "Cargo",
        minWidth: 180,
        flex: 0.7,
        valueFormatter: (params) => String(params.value || "Sin cargo"),
      },
      {
        field: "department",
        headerName: "Departamento",
        minWidth: 180,
        flex: 0.7,
        valueFormatter: (params) => String(params.value || "Sin departamento"),
      },
      {
        field: "last_login",
        headerName: "Último acceso",
        width: 175,
        valueFormatter: (params) => formatDateTime(String(params.value || "")),
      },
      {
        colId: "actions",
        headerName: "Acciones",
        width: 215,
        sortable: false,
        filter: false,
        pinned: "right",
        cellRenderer: (params: ICellRendererParams<AuthUser>) => (
          <Stack direction="row" spacing={0.5}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                if (params.data) setSelectedUser(params.data);
              }}
            >
              Ver
            </Button>
            <Button
              size="small"
              startIcon={<EditIcon />}
              onClick={() => {
                if (params.data) openUserForm(params.data);
              }}
            >
              Editar
            </Button>
          </Stack>
        ),
      },
    ];
  }, []);

  if (loading) {
    return (
      <Stack spacing={2} sx={{ alignItems: "center", py: 6 }}>
        <CircularProgress />
        <Typography sx={{ color: colors.text.secondary }}>
          Cargando usuarios...
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
              label="Cuentas internas"
              icon={<ManageAccountsIcon />}
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
              Usuarios
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
              Los usuarios son trabajadores de SERKAN con una cuenta para ingresar a la plataforma. El rol asignado define qué información y acciones puede utilizar cada persona.
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              variant="outlined"
              startIcon={
                refreshing ? <CircularProgress size={18} /> : <RefreshIcon />
              }
              onClick={() => void loadUsers("refresh")}
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
              onClick={() => openUserForm()}
            >
              Nuevo usuario
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
        Usuario, colaborador y contacto externo son entidades separadas. Esta
        pantalla solo gestiona cuentas de acceso.
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
          title="Usuarios"
          value={formatNumber(users.length)}
          helper={`${formatNumber(summary.active)} activos`}
          icon={<ManageAccountsIcon />}
        />

        <SummaryCard
          title="Administradores"
          value={formatNumber(summary.admins)}
          helper="Usuarios con rol crítico"
          icon={<AdminPanelSettingsIcon />}
        />

        <SummaryCard
          title="Staff Django"
          value={formatNumber(summary.staff)}
          helper="Usuarios con acceso staff"
          icon={<BadgeIcon />}
        />

        <SummaryCard
          title="Inactivos"
          value={formatNumber(summary.inactive)}
          helper="Usuarios sin acceso activo"
          icon={<LockIcon />}
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
                Cuentas registradas
              </Typography>
              <Typography variant="body2" sx={{ color: colors.text.muted }}>
                Filtros compartidos, columnas configurables y vistas personales.
              </Typography>
            </Box>

            <SerkanFilterToolbar
              searchLabel="Buscar usuarios"
              searchPlaceholder="Usuario, nombre, correo, cargo o departamento..."
              searchValue={searchTerm}
              onSearchValueChange={setSearchTerm}
              onApply={() => setPagination((current) => ({ ...current, page: 0 }))}
              onClear={() => {
                setSearchTerm("");
                setRoleFilter([]);
                setStatusFilter([]);
                setColumnFilters([]);
                setPagination((current) => ({ ...current, page: 0 }));
                setFilterResetKey((current) => current + 1);
              }}
              loading={refreshing}
              expanded={filtersExpanded}
              onExpandedChange={setFiltersExpanded}
              activeFiltersCount={roleFilter.length + statusFilter.length + columnFilters.length}
              panelId="users-advanced-filters"
            >
              <SerkanMultiSelectFilter
                label="Rol"
                options={roleOptions.map((role) => ({ value: role.value, label: role.label }))}
                value={roleFilter}
                onChange={setRoleFilter}
              />
              <SerkanMultiSelectFilter
                label="Estado"
                options={[
                  { value: "ACTIVO", label: "Activo" },
                  { value: "INACTIVO", label: "Inactivo" },
                  { value: "ANULADO", label: "Anulado" },
                  { value: "ARCHIVADO", label: "Archivado" },
                ]}
                value={statusFilter}
                onChange={setStatusFilter}
              />
            </SerkanFilterToolbar>

            <SerkanDataGrid
              gridKey="accounts.users"
              serverManaged
              clientManaged
              ariaLabel="Cuentas de usuario"
              rows={filteredUsers}
              columns={columns}
              loading={refreshing}
              paginationModel={pagination}
              onPaginationModelChange={setPagination}
              rowCount={filteredUsers.length}
              sortModel={sortModel}
              onSortModelChange={setSortModel}
              onFilterModelChange={(filters) => {
                setColumnFilters(filters);
                setPagination((current) => ({ ...current, page: 0 }));
              }}
              filterResetKey={filterResetKey}
              namedViewFilters={{
                search: searchTerm,
                role: roleFilter.join(","),
                status: statusFilter.join(","),
              }}
            />
          </Stack>
        </CardContent>
      </Card>

      <Dialog
        open={createDialogOpen}
        onClose={closeUserForm}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>{editingUser ? "Editar usuario" : "Nuevo usuario interno"}</DialogTitle>

        <DialogContent>
          <Stack spacing={2.2} sx={{ mt: 1 }}>
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <Alert severity="info" variant="outlined">
              {editingUser
                ? "Puedes actualizar los datos operativos, el rol y el estado de acceso. La contraseña se administra por separado."
                : "Este formulario crea una cuenta de acceso. No crea ficha de colaborador ni contacto externo."}
            </Alert>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Usuario"
                value={form.username}
                onChange={(event) =>
                  updateFormField("username", event.target.value)
                }
                required
                disabled={Boolean(editingUser)}
                helperText={editingUser ? "El nombre de usuario no se modifica desde este formulario." : undefined}
                fullWidth
                autoComplete="username"
              />

              <TextField
                label="Correo"
                type="email"
                value={form.email}
                onChange={(event) =>
                  updateFormField("email", event.target.value)
                }
                fullWidth
                autoComplete="email"
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Nombres"
                value={form.first_name}
                onChange={(event) =>
                  updateFormField("first_name", event.target.value)
                }
                fullWidth
                autoComplete="given-name"
              />

              <TextField
                label="Apellidos"
                value={form.last_name}
                onChange={(event) =>
                  updateFormField("last_name", event.target.value)
                }
                fullWidth
                autoComplete="family-name"
              />
            </Stack>

            {!editingUser ? (
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Contraseña temporal"
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    updateFormField("password", event.target.value)
                  }
                  required
                  fullWidth
                  autoComplete="new-password"
                />

                <TextField
                  label="Confirmar contraseña"
                  type="password"
                  value={form.password_confirm}
                  onChange={(event) =>
                    updateFormField("password_confirm", event.target.value)
                  }
                  required
                  fullWidth
                  autoComplete="new-password"
                />
              </Stack>
            ) : null}

            <TextField
              select
              label="Rol"
              value={form.role}
              onChange={(event) => updateFormField("role", event.target.value)}
              disabled={Boolean(
                editingUser?.role === "ADMINISTRADOR" && !canCreateAdmin,
              )}
              helperText={
                editingUser?.role === "ADMINISTRADOR" && !canCreateAdmin
                  ? "Solo un Administrador puede modificar este rol."
                  : undefined
              }
              fullWidth
              required
            >
              {availableRoles.map((role) => (
                <MenuItem key={role.value} value={role.value}>
                  {role.label}
                </MenuItem>
              ))}
            </TextField>

            {editingUser ? (
              <TextField
                select
                label="Estado de acceso"
                value={form.status}
                onChange={(event) => updateFormField("status", event.target.value)}
                fullWidth
              >
                <MenuItem value="ACTIVO">Activo</MenuItem>
                <MenuItem value="INACTIVO">Inactivo</MenuItem>
                <MenuItem value="ANULADO">Anulado</MenuItem>
                <MenuItem value="ARCHIVADO">Archivado</MenuItem>
              </TextField>
            ) : null}

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Teléfono"
                value={form.phone}
                onChange={(event) =>
                  updateFormField("phone", event.target.value)
                }
                fullWidth
                autoComplete="tel"
              />

              <TextField
                label="Cargo"
                value={form.position}
                onChange={(event) =>
                  updateFormField("position", event.target.value)
                }
                fullWidth
              />

              <TextField
                label="Departamento"
                value={form.department}
                onChange={(event) =>
                  updateFormField("department", event.target.value)
                }
                fullWidth
              />
            </Stack>

            <TextField
              label="Observaciones"
              value={form.observations}
              onChange={(event) =>
                updateFormField("observations", event.target.value)
              }
              multiline
              minRows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={closeUserForm} disabled={saving}>
            Cancelar
          </Button>

          <Button
            variant="contained"
            onClick={handleSaveUser}
            disabled={
              saving ||
              !form.username.trim() ||
              (!editingUser && (!form.password || !form.password_confirm))
            }
          >
            {saving ? "Guardando..." : editingUser ? "Guardar cambios" : "Crear usuario"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(selectedUser)}
        onClose={() => setSelectedUser(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {selectedUser?.full_name ||
            selectedUser?.username ||
            "Detalle de usuario"}
        </DialogTitle>

        <DialogContent>
          {selectedUser ? (
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ flexWrap: "wrap" }}
              >
                <RoleChip user={selectedUser} />
                <StatusChip user={selectedUser} />

                {selectedUser.is_superuser ? (
                  <Chip
                    label="Superusuario"
                    size="small"
                    variant="outlined"
                    sx={{
                      color: colors.status.warning,
                      bgcolor: colors.status.warningSoft,
                      borderColor: colors.secondary.border,
                      fontWeight: 850,
                    }}
                  />
                ) : null}
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
                    {selectedUser.username}
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: colors.text.secondary, fontWeight: 800 }}
                  >
                    Correo
                  </Typography>

                  <Typography sx={{ color: colors.text.primary }}>
                    {selectedUser.email || "Sin correo"}
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
                    {selectedUser.position || "Sin cargo"}
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
                    {selectedUser.department || "Sin departamento"}
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
                    {selectedUser.phone || "Sin teléfono"}
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: colors.text.secondary, fontWeight: 800 }}
                  >
                    Último acceso
                  </Typography>

                  <Typography sx={{ color: colors.text.primary }}>
                    {formatDateTime(selectedUser.last_login)}
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
                  {selectedUser.observations || "Sin observaciones"}
                </Typography>
              </Box>

              <Divider />

              <ProfileDocumentsSection
                ownerKind="user"
                ownerId={selectedUser.id}
                ownerLabel={selectedUser.full_name || selectedUser.username}
              />

              <Divider />

              <Box>
                <Typography variant="caption" sx={{ color: colors.text.muted }}>
                  Fecha de ingreso al sistema:{" "}
                  {formatDateTime(selectedUser.date_joined)}
                </Typography>

                <Typography
                  variant="caption"
                  sx={{ color: colors.text.muted, display: "block" }}
                >
                  Última actualización:{" "}
                  {formatDateTime(selectedUser.updated_at)}
                </Typography>
              </Box>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          {selectedUser ? (
            <Button
              startIcon={<EditIcon />}
              onClick={() => {
                openUserForm(selectedUser);
                setSelectedUser(null);
              }}
            >
              Editar usuario
            </Button>
          ) : null}
          <Button onClick={() => setSelectedUser(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
