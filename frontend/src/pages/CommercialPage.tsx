import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import axios from "axios";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import BusinessIcon from "@mui/icons-material/Business";
import CorporateFareIcon from "@mui/icons-material/CorporateFare";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import GroupsIcon from "@mui/icons-material/Groups";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { SerkanDataGrid, type SerkanGridFilter, type SerkanGridSortModel } from "../components/SerkanDataGrid";
import { SerkanFilterToolbar } from "../components/filters/SerkanFilterToolbar";
import {
  createArea,
  createContacto,
  createHolding,
  createMinera,
  createSubarea,
  fetchAreas,
  fetchCiudades,
  fetchContactos,
  fetchHoldings,
  fetchMineras,
  fetchSubareas,
  updateArea,
  updateContacto,
  updateHolding,
  updateMinera,
  updateSubarea,
} from "../services/commercialService";
import type {
  Area,
  Ciudad,
  Contacto,
  Holding,
  Minera,
  Subarea,
} from "../services/commercialService";
import { colors } from "../theme/colors";

type CommercialRecord = Holding | Minera | Area | Subarea | Contacto;

type CommercialTab =
  | "holdings"
  | "mineras"
  | "areas"
  | "subareas"
  | "contactos";

type HoldingForm = {
  name: string;
  description: string;
};

type MineraForm = {
  name: string;
  rut: string;
  holding: number | null;
  city: number | null;
  email: string;
  phone: string;
  address: string;
  observations: string;
};

type AreaForm = {
  minera: number | null;
  name: string;
  location: string;
  description: string;
};

type SubareaForm = {
  area: number | null;
  name: string;
  description: string;
};

type ContactoForm = {
  first_name: string;
  last_name: string;
  position: string;
  subarea: number | null;
  city: number | null;
  email: string;
  phone: string;
  shift_mode: "DIA" | "NOCHE" | "SIN_DEFINIR";
  active_days: string;
  rest_days: string;
  active_cycle_start_date: string;
  observations: string;
};

const emptyHoldingForm: HoldingForm = {
  name: "",
  description: "",
};

const emptyMineraForm: MineraForm = {
  name: "",
  rut: "",
  holding: null,
  city: null,
  email: "",
  phone: "",
  address: "",
  observations: "",
};

const emptyAreaForm: AreaForm = {
  minera: null,
  name: "",
  location: "",
  description: "",
};

const emptySubareaForm: SubareaForm = {
  area: null,
  name: "",
  description: "",
};

const emptyContactoForm: ContactoForm = {
  first_name: "",
  last_name: "",
  position: "",
  subarea: null,
  city: null,
  email: "",
  phone: "",
  shift_mode: "SIN_DEFINIR",
  active_days: "",
  rest_days: "",
  active_cycle_start_date: "",
  observations: "",
};

const tabLabels: Record<CommercialTab, string> = {
  holdings: "Holdings",
  mineras: "Mineras",
  areas: "Áreas",
  subareas: "Subáreas",
  contactos: "Contactos",
};
function getContactCycleError(form: ContactoForm) {
  const hasAnyValue = Boolean(
    form.active_days || form.rest_days || form.active_cycle_start_date,
  );
  if (!hasAnyValue) return "";
  if (!form.active_days || !form.rest_days || !form.active_cycle_start_date) {
    return "Para calcular la disponibilidad debes completar días activos, días de descanso y fecha de inicio.";
  }
  if (Number(form.active_days) < 1 || Number(form.rest_days) < 1) {
    return "Los días activos y de descanso deben ser mayores a cero.";
  }
  return "";
}

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

function formatDateTime(value: string) {
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

function formatContactCycle(contact: Contacto) {
  if (!contact.active_days || !contact.rest_days || !contact.active_cycle_start_date) {
    return "Sin ciclo definido";
  }

  const startDate = new Date(`${contact.active_cycle_start_date}T00:00:00`);
  const startLabel = new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
  }).format(startDate);

  return `${contact.active_days}x${contact.rest_days} · desde ${startLabel}`;
}

function getContactAvailability(contact: Contacto, date: Date) {
  if (
    !contact.active_days ||
    !contact.rest_days ||
    !contact.active_cycle_start_date
  ) {
    return "SIN_DEFINIR";
  }

  const cycleStart = new Date(`${contact.active_cycle_start_date}T00:00:00`);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const elapsedDays = Math.floor(
    (target.getTime() - cycleStart.getTime()) / 86_400_000,
  );
  const cycleLength = contact.active_days + contact.rest_days;
  const cycleDay = ((elapsedDays % cycleLength) + cycleLength) % cycleLength;

  return cycleDay < contact.active_days ? "TRABAJA" : "DESCANSA";
}

function normalizeSearch(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function filterRows<T extends { id: number | string }>(
  rows: T[],
  searchTerm: string,
) {
  const normalizedTerm = normalizeSearch(searchTerm.trim());

  if (!normalizedTerm) {
    return rows;
  }

  return rows.filter((row) =>
    Object.values(row).some((value) =>
      normalizeSearch(value).includes(normalizedTerm),
    ),
  );
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
        borderColor: isActive ? colors.status.success : colors.border.medium,
        fontWeight: 800,
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
  value: number;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <Card
      sx={{
        p: 2.2,
        bgcolor: colors.background.paper,
        border: `1px solid ${colors.border.light}`,
        height: "100%",
      }}
    >
      <Stack direction="row" spacing={1.6} sx={{ alignItems: "center" }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            display: "grid",
            placeItems: "center",
            borderRadius: colors.radius.md,
            color: colors.modules.commercial.main,
            bgcolor: colors.modules.commercial.soft,
            border: `1px solid ${colors.modules.commercial.border}`,
            "& svg": { fontSize: 26 },
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
            sx={{ color: colors.text.primary, fontWeight: 900 }}
          >
            {new Intl.NumberFormat("es-CL").format(value)}
          </Typography>

          <Typography variant="caption" sx={{ color: colors.text.muted }}>
            {helper}
          </Typography>
        </Box>
      </Stack>
    </Card>
  );
}

function ContactAvailabilityCalendar({ contact }: { contact: Contacto }) {
  const [visibleMonth, setVisibleMonth] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const monthNames = Array.from({ length: 12 }, (_, month) =>
    new Intl.DateTimeFormat("es-CL", { month: "long" }).format(new Date(2026, month, 1)),
  );
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 21 }, (_, index) => currentYear - 5 + index);
  const monthStartOffset = (visibleMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0,
  ).getDate();
  const days = Array.from({ length: monthStartOffset + daysInMonth }, (_, index) =>
    index < monthStartOffset
      ? null
      : new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index - monthStartOffset + 1),
  );

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <TextField
          select
          label="Mes"
          value={visibleMonth.getMonth()}
          onChange={(event) =>
            setVisibleMonth(new Date(visibleMonth.getFullYear(), Number(event.target.value), 1))
          }
          fullWidth
        >
          {monthNames.map((month, index) => (
            <MenuItem key={month} value={index} sx={{ textTransform: "capitalize" }}>
              {month}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Año"
          value={visibleMonth.getFullYear()}
          onChange={(event) =>
            setVisibleMonth(new Date(Number(event.target.value), visibleMonth.getMonth(), 1))
          }
          fullWidth
        >
          {yearOptions.map((year) => (
            <MenuItem key={year} value={year}>{year}</MenuItem>
          ))}
        </TextField>
        <Button
          variant="outlined"
          onClick={() => setVisibleMonth(new Date(currentYear, new Date().getMonth(), 1))}
          sx={{ minWidth: 130 }}
        >
          Ir a hoy
        </Button>
      </Stack>
      {!contact.active_days || !contact.rest_days || !contact.active_cycle_start_date ? (
        <Alert severity="warning">
          Este contacto todavía no tiene un ciclo completo. Edítalo para indicar días activos, descanso y fecha de inicio.
        </Alert>
      ) : (
        <Alert severity="info">
          Ciclo {contact.active_days}x{contact.rest_days}, modalidad {contact.shift_mode_display.toLowerCase()}.
        </Alert>
      )}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 0.75 }}>
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
          <Typography key={day} variant="caption" align="center" sx={{ fontWeight: 800 }}>
            {day}
          </Typography>
        ))}
        {days.map((date, index) => {
          if (!date) return <Box key={`empty-${index}`} />;
          const availability = getContactAvailability(contact, date);
          return (
            <Box
              key={date.toISOString()}
              title={availability === "TRABAJA" ? "Trabaja" : availability === "DESCANSA" ? "Descansa" : "Sin definir"}
              sx={{
                minHeight: 48,
                display: "grid",
                placeItems: "center",
                borderRadius: 1,
                fontWeight: 800,
                bgcolor: availability === "TRABAJA" ? "success.dark" : availability === "DESCANSA" ? "error.dark" : "action.disabledBackground",
                color: availability === "SIN_DEFINIR" ? "text.secondary" : "common.white",
              }}
            >
              {date.getDate()}
            </Box>
          );
        })}
      </Box>
      <Stack direction="row" spacing={2}>
        <Chip label="Trabaja" color="success" size="small" />
        <Chip label="Descansa" color="error" size="small" />
      </Stack>
    </Stack>
  );
}

export function CommercialPage() {
  const [activeTab, setActiveTab] = useState<CommercialTab>("mineras");
  const [searchTerm, setSearchTerm] = useState("");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [sortModel, setSortModel] = useState<SerkanGridSortModel>(null);
  const [columnFilters, setColumnFilters] = useState<SerkanGridFilter[]>([]);
  const [filterResetKey, setFilterResetKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [availabilityContact, setAvailabilityContact] = useState<Contacto | null>(null);
  const [editingRecord, setEditingRecord] = useState<{ type: CommercialTab; id: number } | null>(null);

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [mineras, setMineras] = useState<Minera[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [subareas, setSubareas] = useState<Subarea[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);

  const [createDialog, setCreateDialog] = useState<CommercialTab | null>(null);
  const [holdingForm, setHoldingForm] = useState<HoldingForm>(emptyHoldingForm);
  const [mineraForm, setMineraForm] = useState<MineraForm>(emptyMineraForm);
  const [areaForm, setAreaForm] = useState<AreaForm>(emptyAreaForm);
  const [subareaForm, setSubareaForm] = useState<SubareaForm>(emptySubareaForm);
  const [contactoForm, setContactoForm] =
    useState<ContactoForm>(emptyContactoForm);

  const loadCommercialData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [
        holdingsData,
        minerasData,
        areasData,
        subareasData,
        contactosData,
        ciudadesData,
      ] = await Promise.all([
        fetchHoldings(),
        fetchMineras(),
        fetchAreas(),
        fetchSubareas(),
        fetchContactos(),
        fetchCiudades(),
      ]);

      setHoldings(holdingsData);
      setMineras(minerasData);
      setAreas(areasData);
      setSubareas(subareasData);
      setContactos(contactosData);
      setCiudades(ciudadesData);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCommercialData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadCommercialData]);

  const openEditDialog = (type: CommercialTab, record: CommercialRecord) => {
    setEditingRecord({ type, id: record.id });
    setCreateDialog(type);
    setDialogError("");
    setSuccessMessage("");

    if (type === "holdings") {
      const holding = record as Holding;
      setHoldingForm({ name: holding.name, description: holding.description });
    } else if (type === "mineras") {
      const minera = record as Minera;
      setMineraForm({
        name: minera.name,
        rut: minera.rut ?? "",
        holding: minera.holding,
        city: minera.city,
        email: minera.email,
        phone: minera.phone,
        address: minera.address,
        observations: minera.observations,
      });
    } else if (type === "areas") {
      const area = record as Area;
      setAreaForm({
        minera: area.minera,
        name: area.name,
        location: area.location,
        description: area.description,
      });
    } else if (type === "subareas") {
      const subarea = record as Subarea;
      setSubareaForm({
        area: subarea.area,
        name: subarea.name,
        description: subarea.description,
      });
    } else {
      const contact = record as Contacto;
      setContactoForm({
        first_name: contact.first_name,
        last_name: contact.last_name,
        position: contact.position,
        subarea: contact.subarea,
        city: contact.city,
        email: contact.email,
        phone: contact.phone,
        shift_mode: contact.shift_mode as ContactoForm["shift_mode"],
        active_days: contact.active_days ? String(contact.active_days) : "",
        rest_days: contact.rest_days ? String(contact.rest_days) : "",
        active_cycle_start_date: contact.active_cycle_start_date ?? "",
        observations: contact.observations,
      });
    }
  };

  const activeRows = useMemo(() => {
    if (activeTab === "holdings") return filterRows(holdings, searchTerm);
    if (activeTab === "mineras") return filterRows(mineras, searchTerm);
    if (activeTab === "areas") return filterRows(areas, searchTerm);
    if (activeTab === "subareas") return filterRows(subareas, searchTerm);

    return filterRows(contactos, searchTerm);
  }, [activeTab, areas, contactos, holdings, mineras, searchTerm, subareas]);

  const columns = useMemo<ColDef<CommercialRecord>[]>(() => {
    const editColumn: ColDef<CommercialRecord> = {
      colId: "edit",
      headerName: "Editar",
      width: 110,
      sortable: false,
      filter: false,
      cellRenderer: (params: ICellRendererParams<CommercialRecord>) => (
        <Button
          size="small"
          startIcon={<EditIcon />}
          onClick={() => params.data && openEditDialog(activeTab, params.data)}
        >
          Editar
        </Button>
      ),
    };

    if (activeTab === "holdings") {
      return [
        { field: "name", headerName: "Holding", minWidth: 220, flex: 1 },
        {
          field: "description",
          headerName: "Descripción",
          minWidth: 260,
          flex: 1.2,
          cellRenderer: (params: ICellRendererParams<CommercialRecord>) => params.value || "Sin descripción",
        },
        {
          field: "status",
          headerName: "Estado",
          width: 140,
          cellRenderer: (params: ICellRendererParams<CommercialRecord>) => (
            <StatusChip status={String(params.value || "")} />
          ),
        },
        {
          field: "updated_at",
          headerName: "Última actualización",
          width: 180,
          cellRenderer: (params: ICellRendererParams<CommercialRecord>) => formatDateTime(String(params.value || "")),
        },
        editColumn,
      ];
    }

    if (activeTab === "mineras") {
      return [
        { field: "name", headerName: "Minera", minWidth: 220, flex: 1 },
        {
          field: "rut",
          headerName: "RUT",
          width: 135,
          cellRenderer: (params: ICellRendererParams<CommercialRecord>) => params.value || "Sin RUT",
        },
        {
          field: "holding_name",
          headerName: "Holding",
          minWidth: 180,
          flex: 0.8,
          cellRenderer: (params: ICellRendererParams<CommercialRecord>) => params.value || "Sin holding",
        },
        {
          field: "city_name",
          headerName: "Ciudad",
          width: 150,
          cellRenderer: (params: ICellRendererParams<CommercialRecord>) => params.value || "Sin ciudad",
        },
        {
          field: "email",
          headerName: "Correo",
          minWidth: 190,
          flex: 0.8,
          cellRenderer: (params: ICellRendererParams<CommercialRecord>) => params.value || "Sin correo",
        },
        {
          field: "phone",
          headerName: "Teléfono",
          width: 150,
          cellRenderer: (params: ICellRendererParams<CommercialRecord>) => params.value || "Sin teléfono",
        },
        {
          field: "status",
          headerName: "Estado",
          width: 140,
          cellRenderer: (params: ICellRendererParams<CommercialRecord>) => (
            <StatusChip status={String(params.value || "")} />
          ),
        },
        editColumn,
      ];
    }

    if (activeTab === "areas") {
      return [
        { field: "name", headerName: "Área", minWidth: 220, flex: 1 },
        {
          field: "minera_name",
          headerName: "Minera",
          minWidth: 220,
          flex: 1,
        },
        {
          field: "holding_name",
          headerName: "Holding",
          minWidth: 180,
          flex: 0.8,
          cellRenderer: (params: ICellRendererParams<CommercialRecord>) => params.value || "Sin holding",
        },
        {
          field: "location",
          headerName: "Ubicación",
          minWidth: 180,
          flex: 0.7,
          cellRenderer: (params: ICellRendererParams<CommercialRecord>) => params.value || "Sin ubicación",
        },
        {
          field: "status",
          headerName: "Estado",
          width: 140,
          cellRenderer: (params: ICellRendererParams<CommercialRecord>) => (
            <StatusChip status={String(params.value || "")} />
          ),
        },
        editColumn,
      ];
    }

    if (activeTab === "subareas") {
      return [
        { field: "name", headerName: "Subárea", minWidth: 220, flex: 1 },
        {
          field: "area_name",
          headerName: "Área",
          minWidth: 190,
          flex: 0.9,
        },
        {
          field: "minera_name",
          headerName: "Minera",
          minWidth: 210,
          flex: 1,
        },
        {
          field: "holding_name",
          headerName: "Holding",
          minWidth: 180,
          flex: 0.8,
          cellRenderer: (params: ICellRendererParams<CommercialRecord>) => params.value || "Sin holding",
        },
        {
          field: "description",
          headerName: "Descripción",
          minWidth: 240,
          flex: 1,
          cellRenderer: (params: ICellRendererParams<CommercialRecord>) => params.value || "Sin descripción",
        },
        {
          field: "status",
          headerName: "Estado",
          width: 140,
          cellRenderer: (params: ICellRendererParams<CommercialRecord>) => (
            <StatusChip status={String(params.value || "")} />
          ),
        },
        editColumn,
      ];
    }

    return [
      {
        field: "full_name",
        headerName: "Contacto",
        minWidth: 220,
        flex: 1,
      },
      {
        field: "position",
        headerName: "Cargo",
        minWidth: 180,
        flex: 0.8,
        cellRenderer: (params: ICellRendererParams<CommercialRecord>) => params.value || "Sin cargo",
      },
      {
        field: "minera_name",
        headerName: "Minera",
        minWidth: 200,
        flex: 0.9,
      },
      {
        field: "area_name",
        headerName: "Área",
        minWidth: 170,
        flex: 0.7,
      },
      {
        field: "subarea_name",
        headerName: "Subárea",
        minWidth: 180,
        flex: 0.7,
      },
      {
        field: "email",
        headerName: "Correo",
        minWidth: 210,
        flex: 1,
        cellRenderer: (params: ICellRendererParams<CommercialRecord>) => params.value || "Sin correo",
      },
      {
        field: "phone",
        headerName: "Teléfono",
        width: 150,
        cellRenderer: (params: ICellRendererParams<CommercialRecord>) => params.value || "Sin teléfono",
      },
      {
        field: "shift_mode_display",
        headerName: "Modalidad",
        width: 135,
        cellRenderer: (params: ICellRendererParams<CommercialRecord>) => params.value || "Sin definir",
      },

      {
        colId: "cycle",
        headerName: "Ciclo laboral",
        minWidth: 200,
        flex: 0.8,
        sortable: false,
        filter: false,
        cellRenderer: (params: ICellRendererParams<CommercialRecord>) => formatContactCycle(params.data as Contacto),
      },
      {
        field: "status",
        headerName: "Estado",
        width: 140,
        cellRenderer: (params: ICellRendererParams<CommercialRecord>) => (
          <StatusChip status={String(params.value || "")} />
        ),
      },
      {
        colId: "availability",
        headerName: "Disponibilidad",
        width: 175,
        sortable: false,
        filter: false,
        cellRenderer: (params: ICellRendererParams<CommercialRecord>) => (
          <Button
            size="small"
            startIcon={<CalendarMonthIcon />}
            onClick={() => setAvailabilityContact(params.data as Contacto)}
          >
            Ver calendario
          </Button>
        ),
      },
      editColumn,
    ];
  }, [activeTab]);

  const openCreateDialog = (type: CommercialTab) => {
    setEditingRecord(null);
    resetForms();
    setCreateDialog(type);
    setErrorMessage("");
    setSuccessMessage("");
    setDialogError("");
  };

  const closeCreateDialog = () => {
    if (saving) return;

    setCreateDialog(null);
    setEditingRecord(null);
    setDialogError("");
  };

  const resetForms = () => {
    setHoldingForm(emptyHoldingForm);
    setMineraForm(emptyMineraForm);
    setAreaForm(emptyAreaForm);
    setSubareaForm(emptySubareaForm);
    setContactoForm(emptyContactoForm);
  };

  const canSaveCreate = () => {
    if (createDialog === "holdings") {
      return Boolean(holdingForm.name.trim());
    }

    if (createDialog === "mineras") {
      return Boolean(mineraForm.name.trim());
    }

    if (createDialog === "areas") {
      return Boolean(areaForm.minera && areaForm.name.trim());
    }

    if (createDialog === "subareas") {
      return Boolean(subareaForm.area && subareaForm.name.trim());
    }

    if (createDialog === "contactos") {
      return Boolean(
        contactoForm.subarea &&
          contactoForm.first_name.trim() &&
          !getContactCycleError(contactoForm)
      );
    }

    return false;
  };

  const handleCreate = async () => {
    if (!createDialog) return;

    try {
      setSaving(true);
      setDialogError("");
      setErrorMessage("");
      setSuccessMessage("");
      const isEditing = editingRecord?.type === createDialog;

      if (createDialog === "holdings") {
        const payload = {
          name: holdingForm.name.trim(),
          description: holdingForm.description.trim(),
        };
        if (isEditing) await updateHolding(editingRecord.id, payload);
        else await createHolding(payload);
        setSuccessMessage(isEditing ? "Holding actualizado correctamente." : "Holding creado correctamente.");
      }

      if (createDialog === "mineras") {
        const payload = {
          name: mineraForm.name.trim(),
          rut: mineraForm.rut.trim() || null,
          holding: mineraForm.holding,
          city: mineraForm.city,
          email: mineraForm.email.trim(),
          phone: mineraForm.phone.trim(),
          address: mineraForm.address.trim(),
          observations: mineraForm.observations.trim(),
        };
        if (isEditing) await updateMinera(editingRecord.id, payload);
        else await createMinera(payload);
        setSuccessMessage(isEditing ? "Minera actualizada correctamente." : "Minera creada correctamente.");
      }

      if (createDialog === "areas") {
        const payload = {
          minera: Number(areaForm.minera),
          name: areaForm.name.trim(),
          location: areaForm.location.trim(),
          description: areaForm.description.trim(),
        };
        if (isEditing) await updateArea(editingRecord.id, payload);
        else await createArea(payload);
        setSuccessMessage(isEditing ? "Área actualizada correctamente." : "Área creada correctamente.");
      }

      if (createDialog === "subareas") {
        const payload = {
          area: Number(subareaForm.area),
          name: subareaForm.name.trim(),
          description: subareaForm.description.trim(),
        };
        if (isEditing) await updateSubarea(editingRecord.id, payload);
        else await createSubarea(payload);
        setSuccessMessage(isEditing ? "Subárea actualizada correctamente." : "Subárea creada correctamente.");
      }

      if (createDialog === "contactos") {
        const payload = {
          first_name: contactoForm.first_name.trim(),
          last_name: contactoForm.last_name.trim(),
          position: contactoForm.position.trim(),
          subarea: Number(contactoForm.subarea),
          city: contactoForm.city,
          email: contactoForm.email.trim(),
          phone: contactoForm.phone.trim(),
          shift_mode: contactoForm.shift_mode,
          active_days: contactoForm.active_days ? Number(contactoForm.active_days) : null,
          rest_days: contactoForm.rest_days ? Number(contactoForm.rest_days) : null,
          active_cycle_start_date: contactoForm.active_cycle_start_date || null,
          observations: contactoForm.observations.trim(),
        };
        if (isEditing) await updateContacto(editingRecord.id, payload);
        else await createContacto(payload);
        setSuccessMessage(isEditing ? "Contacto actualizado correctamente." : "Contacto creado correctamente.");
      }

      setCreateDialog(null);
      setEditingRecord(null);
      resetForms();
      await loadCommercialData();
    } catch (error: unknown) {
      setDialogError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  const renderCreateDialogContent = () => {
    if (createDialog === "holdings") {
      return (
        <Stack spacing={2.2} sx={{ mt: 1 }}>
          <TextField
            label="Nombre del holding"
            value={holdingForm.name}
            onChange={(event) =>
              setHoldingForm((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            fullWidth
            required
          />

          <TextField
            label="Descripción"
            value={holdingForm.description}
            onChange={(event) =>
              setHoldingForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            fullWidth
            multiline
            minRows={3}
          />
        </Stack>
      );
    }

    if (createDialog === "mineras") {
      return (
        <Stack spacing={2.2} sx={{ mt: 1 }}>
          <TextField
            label="Nombre de la minera"
            value={mineraForm.name}
            onChange={(event) =>
              setMineraForm((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            fullWidth
            required
          />

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="RUT"
              value={mineraForm.rut}
              onChange={(event) =>
                setMineraForm((current) => ({
                  ...current,
                  rut: event.target.value,
                }))
              }
              fullWidth
            />

            <Autocomplete
              options={holdings}
              value={
                holdings.find((holding) => holding.id === mineraForm.holding) ??
                null
              }
              onChange={(_event, value) =>
                setMineraForm((current) => ({
                  ...current,
                  holding: value?.id ?? null,
                }))
              }
              getOptionLabel={(option) => option.name}
              renderInput={(params) => (
                <TextField {...params} label="Holding asociado" />
              )}
            />
          </Stack>

          <Autocomplete
            options={ciudades}
            value={ciudades.find((city) => city.id === mineraForm.city) ?? null}
            onChange={(_event, value) =>
              setMineraForm((current) => ({
                ...current,
                city: value?.id ?? null,
              }))
            }
            getOptionLabel={(option) =>
              option.region ? `${option.name} — ${option.region}` : option.name
            }
            renderInput={(params) => <TextField {...params} label="Ciudad" />}
          />

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="Correo"
              value={mineraForm.email}
              onChange={(event) =>
                setMineraForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              fullWidth
            />

            <TextField
              label="Teléfono"
              value={mineraForm.phone}
              onChange={(event) =>
                setMineraForm((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
              fullWidth
            />
          </Stack>

          <TextField
            label="Dirección"
            value={mineraForm.address}
            onChange={(event) =>
              setMineraForm((current) => ({
                ...current,
                address: event.target.value,
              }))
            }
            fullWidth
          />

          <TextField
            label="Observaciones"
            value={mineraForm.observations}
            onChange={(event) =>
              setMineraForm((current) => ({
                ...current,
                observations: event.target.value,
              }))
            }
            fullWidth
            multiline
            minRows={3}
          />
        </Stack>
      );
    }

    if (createDialog === "areas") {
      return (
        <Stack spacing={2.2} sx={{ mt: 1 }}>
          <Autocomplete
            options={mineras}
            value={
              mineras.find((minera) => minera.id === areaForm.minera) ?? null
            }
            onChange={(_event, value) =>
              setAreaForm((current) => ({
                ...current,
                minera: value?.id ?? null,
              }))
            }
            getOptionLabel={(option) =>
              option.holding_name
                ? `${option.name} — ${option.holding_name}`
                : option.name
            }
            renderInput={(params) => (
              <TextField {...params} label="Minera" required />
            )}
          />

          <TextField
            label="Nombre del área"
            value={areaForm.name}
            onChange={(event) =>
              setAreaForm((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            fullWidth
            required
          />

          <TextField
            label="Ubicación"
            value={areaForm.location}
            onChange={(event) =>
              setAreaForm((current) => ({
                ...current,
                location: event.target.value,
              }))
            }
            fullWidth
          />

          <TextField
            label="Descripción"
            value={areaForm.description}
            onChange={(event) =>
              setAreaForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            fullWidth
            multiline
            minRows={3}
          />
        </Stack>
      );
    }

    if (createDialog === "subareas") {
      return (
        <Stack spacing={2.2} sx={{ mt: 1 }}>
          <Autocomplete
            options={areas}
            value={areas.find((area) => area.id === subareaForm.area) ?? null}
            onChange={(_event, value) =>
              setSubareaForm((current) => ({
                ...current,
                area: value?.id ?? null,
              }))
            }
            getOptionLabel={(option) =>
              `${option.name} — ${option.minera_name}`
            }
            renderInput={(params) => (
              <TextField {...params} label="Área" required />
            )}
          />

          <TextField
            label="Nombre de la subárea"
            value={subareaForm.name}
            onChange={(event) =>
              setSubareaForm((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            fullWidth
            required
          />

          <TextField
            label="Descripción"
            value={subareaForm.description}
            onChange={(event) =>
              setSubareaForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            fullWidth
            multiline
            minRows={3}
          />
        </Stack>
      );
    }

    if (createDialog === "contactos") {
      return (
        <Stack spacing={2.2} sx={{ mt: 1 }}>
          <Autocomplete
            options={subareas}
            value={
              subareas.find((subarea) => subarea.id === contactoForm.subarea) ??
              null
            }
            onChange={(_event, value) =>
              setContactoForm((current) => ({
                ...current,
                subarea: value?.id ?? null,
              }))
            }
            getOptionLabel={(option) =>
              `${option.name} — ${option.area_name} — ${option.minera_name}`
            }
            renderInput={(params) => (
              <TextField {...params} label="Subárea obligatoria" required />
            )}
          />

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="Nombres"
              value={contactoForm.first_name}
              onChange={(event) =>
                setContactoForm((current) => ({
                  ...current,
                  first_name: event.target.value,
                }))
              }
              fullWidth
              required
            />

            <TextField
              label="Apellidos"
              value={contactoForm.last_name}
              onChange={(event) =>
                setContactoForm((current) => ({
                  ...current,
                  last_name: event.target.value,
                }))
              }
              fullWidth
            />
          </Stack>

          <TextField
            label="Cargo"
            value={contactoForm.position}
            onChange={(event) =>
              setContactoForm((current) => ({
                ...current,
                position: event.target.value,
              }))
            }
            fullWidth
          />

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="Correo"
              value={contactoForm.email}
              onChange={(event) =>
                setContactoForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              fullWidth
            />

            <TextField
              label="Teléfono"
              value={contactoForm.phone}
              onChange={(event) =>
                setContactoForm((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
              fullWidth
            />
          </Stack>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <Autocomplete
              options={ciudades}
              value={
                ciudades.find((city) => city.id === contactoForm.city) ?? null
              }
              onChange={(_event, value) =>
                setContactoForm((current) => ({
                  ...current,
                  city: value?.id ?? null,
                }))
              }
              getOptionLabel={(option) =>
                option.region
                  ? `${option.name} — ${option.region}`
                  : option.name
              }
              renderInput={(params) => <TextField {...params} label="Ciudad" />}
            />

            <TextField
              select
              label="Modalidad de turno"
              value={contactoForm.shift_mode}
              onChange={(event) =>
                setContactoForm((current) => ({
                  ...current,
                  shift_mode: event.target.value as ContactoForm["shift_mode"],
                }))
              }
              fullWidth
            >
              <MenuItem value="SIN_DEFINIR">Sin definir</MenuItem>
              <MenuItem value="DIA">Día</MenuItem>
              <MenuItem value="NOCHE">Noche</MenuItem>
            </TextField>
          </Stack>


          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
              gap: 2,
            }}
          >
            <TextField
              label="Días activos"
              type="number"
              value={contactoForm.active_days}
              onChange={(event) =>
                setContactoForm((current) => ({
                  ...current,
                  active_days: event.target.value,
                }))
              }
              error={Boolean(
                (contactoForm.rest_days || contactoForm.active_cycle_start_date) &&
                  (!contactoForm.active_days || Number(contactoForm.active_days) < 1),
              )}
              helperText="Junto a los días de descanso define el ciclo laboral."
              slotProps={{ htmlInput: { min: 1, max: 365 } }}
            />
            <TextField
              label="Días de descanso"
              type="number"
              value={contactoForm.rest_days}
              onChange={(event) =>
                setContactoForm((current) => ({
                  ...current,
                  rest_days: event.target.value,
                }))
              }
              error={Boolean(
                (contactoForm.active_days || contactoForm.active_cycle_start_date) &&
                  (!contactoForm.rest_days || Number(contactoForm.rest_days) < 1),
              )}
              helperText={
                contactoForm.active_days && !contactoForm.rest_days
                  ? "Completa los días de descanso."
                  : undefined
              }
              slotProps={{ htmlInput: { min: 1, max: 365 } }}
            />
            <TextField
              label="Inicio del primer ciclo activo"
              type="date"
              value={contactoForm.active_cycle_start_date}
              onChange={(event) =>
                setContactoForm((current) => ({
                  ...current,
                  active_cycle_start_date: event.target.value,
                }))
              }
              error={Boolean(
                (contactoForm.active_days || contactoForm.rest_days) &&
                  !contactoForm.active_cycle_start_date,
              )}
              helperText={
                (contactoForm.active_days || contactoForm.rest_days) &&
                !contactoForm.active_cycle_start_date
                  ? "Indica cuándo comienza el ciclo activo."
                  : undefined
              }
              slotProps={{ inputLabel: { shrink: true } }}
            />          </Box>

          {getContactCycleError(contactoForm) ? (
            <Alert severity="warning">{getContactCycleError(contactoForm)}</Alert>
          ) : null}
          <TextField
            label="Observaciones"
            value={contactoForm.observations}
            onChange={(event) =>
              setContactoForm((current) => ({
                ...current,
                observations: event.target.value,
              }))
            }
            fullWidth
            multiline
            minRows={3}
          />
        </Stack>
      );
    }

    return null;
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{
          alignItems: { xs: "flex-start", md: "center" },
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{ color: colors.text.primary, fontWeight: 900 }}
          >
            Entidades comerciales
          </Typography>

          <Typography variant="body2" sx={{ color: colors.text.secondary }}>
            Vista funcional de la jerarquía comercial: Holding, Minera, Área,
            Subárea y Contacto. Crear contacto no crea usuario interno.
          </Typography>
        </Box>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => openCreateDialog(activeTab)}
          >
            Crear {tabLabels[activeTab].slice(0, -1)}
          </Button>

          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => void loadCommercialData()}
            disabled={loading}
          >
            Actualizar
          </Button>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(5, minmax(0, 1fr))",
          },
          gap: 2,
        }}
      >
        <SummaryCard
          title="Holdings"
          value={holdings.length}
          helper="Grupos comerciales superiores"
          icon={<CorporateFareIcon />}
        />

        <SummaryCard
          title="Mineras"
          value={mineras.length}
          helper="Empresas o faenas cliente"
          icon={<BusinessIcon />}
        />

        <SummaryCard
          title="Áreas"
          value={areas.length}
          helper="Divisiones por minera"
          icon={<AccountTreeIcon />}
        />

        <SummaryCard
          title="Subáreas"
          value={subareas.length}
          helper="Subdivisiones operativas"
          icon={<AccountTreeIcon />}
        />

        <SummaryCard
          title="Contactos"
          value={contactos.length}
          helper="Personas externas comerciales"
          icon={<GroupsIcon />}
        />
      </Box>

      <Card
        sx={{
          p: 2,
          bgcolor: colors.background.paper,
          border: `1px solid ${colors.border.light}`,
        }}
      >
        <Stack spacing={2}>
          <Tabs
            value={activeTab}
            onChange={(_event, value: CommercialTab) => {
              setActiveTab(value);
              setPagination((current) => ({ ...current, page: 0 }));
              setColumnFilters([]);
              setFilterResetKey((current) => current + 1);
            }}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab value="holdings" label="Holdings" />
            <Tab value="mineras" label="Mineras" />
            <Tab value="areas" label="Áreas" />
            <Tab value="subareas" label="Subáreas" />
            <Tab value="contactos" label="Contactos" />
          </Tabs>

          <Divider />

          <SerkanFilterToolbar
            searchLabel={`Buscar en ${tabLabels[activeTab].toLowerCase()}`}
            searchPlaceholder="Nombre, RUT, correo, teléfono, minera, área o subárea..."
            searchValue={searchTerm}
            onSearchValueChange={setSearchTerm}
            onApply={() => setPagination((current) => ({ ...current, page: 0 }))}
            onClear={() => {
              setSearchTerm("");
              setColumnFilters([]);
              setPagination((current) => ({ ...current, page: 0 }));
              setFilterResetKey((current) => current + 1);
            }}
            loading={loading}
            expanded={filtersExpanded}
            onExpandedChange={setFiltersExpanded}
            activeFiltersCount={columnFilters.length}
            panelId="commercial-advanced-filters"
          >
            <Box />
          </SerkanFilterToolbar>
        </Stack>
      </Card>

      <Alert severity="info" variant="outlined">
        Esta pantalla usa relaciones reales del backend. El frontend ayuda a
        elegir entidades existentes, pero las validaciones críticas siguen
        protegidas en Django.
      </Alert>

      {successMessage ? (
        <Alert severity="success" variant="outlined">
          {successMessage}
        </Alert>
      ) : null}

      {errorMessage ? (
        <Alert severity="error" variant="outlined">
          {errorMessage}
        </Alert>
      ) : null}

      <SerkanDataGrid
        key={activeTab}
        gridKey={`commercial.${activeTab}`}
        serverManaged
        clientManaged
        ariaLabel={tabLabels[activeTab]}
        rows={activeRows}
        columns={columns}
        loading={loading}
        paginationModel={pagination}
        onPaginationModelChange={setPagination}
        rowCount={activeRows.length}
        sortModel={sortModel}
        onSortModelChange={setSortModel}
        onFilterModelChange={(filters) => {
          setColumnFilters(filters);
          setPagination((current) => ({ ...current, page: 0 }));
        }}
        filterResetKey={filterResetKey}
        namedViewFilters={{ search: searchTerm }}
      />

      <Dialog
        open={Boolean(availabilityContact)}
        onClose={() => setAvailabilityContact(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Disponibilidad de {availabilityContact?.full_name ?? "contacto"}
        </DialogTitle>
        <DialogContent>
          {availabilityContact ? <ContactAvailabilityCalendar contact={availabilityContact} /> : null}
        </DialogContent>
        <DialogActions>
          {availabilityContact ? (
            <Button
              startIcon={<EditIcon />}
              onClick={() => {
                openEditDialog("contactos", availabilityContact);
                setAvailabilityContact(null);
              }}
            >
              Editar contacto y turno
            </Button>
          ) : null}
          <Button onClick={() => setAvailabilityContact(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(createDialog)}
        onClose={closeCreateDialog}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {editingRecord
            ? `Editar ${tabLabels[editingRecord.type].slice(0, -1).toLowerCase()}`
            : `Crear ${createDialog ? tabLabels[createDialog].slice(0, -1).toLowerCase() : "registro"}`}
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {dialogError ? <Alert severity="error">{dialogError}</Alert> : null}
            {renderCreateDialogContent()}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={closeCreateDialog} disabled={saving}>
            Cancelar
          </Button>

          <Button
            variant="contained"
            onClick={() => void handleCreate()}
            disabled={saving || !canSaveCreate()}
          >
            {saving ? "Guardando..." : editingRecord ? "Guardar cambios" : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
