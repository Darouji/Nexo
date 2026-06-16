import { useEffect, useMemo, useState } from "react";
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
  InputAdornment,
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
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import type { GridColDef, GridValidRowModel } from "@mui/x-data-grid";
import { SmartDataGrid } from "../components/SmartDataGrid";
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
  shift: string;
  shift_mode: "DIA" | "NOCHE" | "SIN_DEFINIR";
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
  shift: "",
  shift_mode: "SIN_DEFINIR",
  observations: "",
};

const tabLabels: Record<CommercialTab, string> = {
  holdings: "Holdings",
  mineras: "Mineras",
  areas: "Áreas",
  subareas: "Subáreas",
  contactos: "Contactos",
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

function normalizeSearch(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function filterRows<T extends GridValidRowModel>(
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
  icon: React.ReactNode;
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

export function CommercialPage() {
  const [activeTab, setActiveTab] = useState<CommercialTab>("mineras");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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

  const loadCommercialData = async () => {
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
  };

  useEffect(() => {
    void loadCommercialData();
  }, []);

  const activeRows = useMemo(() => {
    if (activeTab === "holdings") return filterRows(holdings, searchTerm);
    if (activeTab === "mineras") return filterRows(mineras, searchTerm);
    if (activeTab === "areas") return filterRows(areas, searchTerm);
    if (activeTab === "subareas") return filterRows(subareas, searchTerm);

    return filterRows(contactos, searchTerm);
  }, [activeTab, areas, contactos, holdings, mineras, searchTerm, subareas]);

  const columns = useMemo<GridColDef[]>(() => {
    if (activeTab === "holdings") {
      return [
        { field: "name", headerName: "Holding", minWidth: 220, flex: 1 },
        {
          field: "description",
          headerName: "Descripción",
          minWidth: 260,
          flex: 1.2,
          renderCell: (params) => params.value || "Sin descripción",
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
          field: "updated_at",
          headerName: "Última actualización",
          width: 180,
          renderCell: (params) => formatDateTime(String(params.value || "")),
        },
      ];
    }

    if (activeTab === "mineras") {
      return [
        { field: "name", headerName: "Minera", minWidth: 220, flex: 1 },
        {
          field: "rut",
          headerName: "RUT",
          width: 135,
          renderCell: (params) => params.value || "Sin RUT",
        },
        {
          field: "holding_name",
          headerName: "Holding",
          minWidth: 180,
          flex: 0.8,
          renderCell: (params) => params.value || "Sin holding",
        },
        {
          field: "city_name",
          headerName: "Ciudad",
          width: 150,
          renderCell: (params) => params.value || "Sin ciudad",
        },
        {
          field: "email",
          headerName: "Correo",
          minWidth: 190,
          flex: 0.8,
          renderCell: (params) => params.value || "Sin correo",
        },
        {
          field: "phone",
          headerName: "Teléfono",
          width: 150,
          renderCell: (params) => params.value || "Sin teléfono",
        },
        {
          field: "status",
          headerName: "Estado",
          width: 140,
          renderCell: (params) => (
            <StatusChip status={String(params.value || "")} />
          ),
        },
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
          renderCell: (params) => params.value || "Sin holding",
        },
        {
          field: "location",
          headerName: "Ubicación",
          minWidth: 180,
          flex: 0.7,
          renderCell: (params) => params.value || "Sin ubicación",
        },
        {
          field: "status",
          headerName: "Estado",
          width: 140,
          renderCell: (params) => (
            <StatusChip status={String(params.value || "")} />
          ),
        },
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
          renderCell: (params) => params.value || "Sin holding",
        },
        {
          field: "description",
          headerName: "Descripción",
          minWidth: 240,
          flex: 1,
          renderCell: (params) => params.value || "Sin descripción",
        },
        {
          field: "status",
          headerName: "Estado",
          width: 140,
          renderCell: (params) => (
            <StatusChip status={String(params.value || "")} />
          ),
        },
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
        renderCell: (params) => params.value || "Sin cargo",
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
        renderCell: (params) => params.value || "Sin correo",
      },
      {
        field: "phone",
        headerName: "Teléfono",
        width: 150,
        renderCell: (params) => params.value || "Sin teléfono",
      },
      {
        field: "shift_mode_display",
        headerName: "Turno",
        width: 135,
        renderCell: (params) => params.value || "Sin definir",
      },
      {
        field: "status",
        headerName: "Estado",
        width: 140,
        renderCell: (params) => (
          <StatusChip status={String(params.value || "")} />
        ),
      },
    ];
  }, [activeTab]);

  const openCreateDialog = (type: CommercialTab) => {
    setCreateDialog(type);
    setErrorMessage("");
    setSuccessMessage("");
  };

  const closeCreateDialog = () => {
    if (saving) return;

    setCreateDialog(null);
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
      return Boolean(contactoForm.subarea && contactoForm.first_name.trim());
    }

    return false;
  };

  const handleCreate = async () => {
    if (!createDialog) return;

    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (createDialog === "holdings") {
        await createHolding({
          name: holdingForm.name.trim(),
          description: holdingForm.description.trim(),
        });

        setSuccessMessage("Holding creado correctamente.");
      }

      if (createDialog === "mineras") {
        await createMinera({
          name: mineraForm.name.trim(),
          rut: mineraForm.rut.trim() || null,
          holding: mineraForm.holding,
          city: mineraForm.city,
          email: mineraForm.email.trim(),
          phone: mineraForm.phone.trim(),
          address: mineraForm.address.trim(),
          observations: mineraForm.observations.trim(),
        });

        setSuccessMessage("Minera creada correctamente.");
      }

      if (createDialog === "areas") {
        await createArea({
          minera: Number(areaForm.minera),
          name: areaForm.name.trim(),
          location: areaForm.location.trim(),
          description: areaForm.description.trim(),
        });

        setSuccessMessage("Área creada correctamente.");
      }

      if (createDialog === "subareas") {
        await createSubarea({
          area: Number(subareaForm.area),
          name: subareaForm.name.trim(),
          description: subareaForm.description.trim(),
        });

        setSuccessMessage("Subárea creada correctamente.");
      }

      if (createDialog === "contactos") {
        await createContacto({
          first_name: contactoForm.first_name.trim(),
          last_name: contactoForm.last_name.trim(),
          position: contactoForm.position.trim(),
          subarea: Number(contactoForm.subarea),
          city: contactoForm.city,
          email: contactoForm.email.trim(),
          phone: contactoForm.phone.trim(),
          shift: contactoForm.shift.trim(),
          shift_mode: contactoForm.shift_mode,
          observations: contactoForm.observations.trim(),
        });

        setSuccessMessage("Contacto creado correctamente.");
      }

      setCreateDialog(null);
      resetForms();
      await loadCommercialData();
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
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

          <TextField
            label="Turno"
            value={contactoForm.shift}
            onChange={(event) =>
              setContactoForm((current) => ({
                ...current,
                shift: event.target.value,
              }))
            }
            fullWidth
            placeholder="Ejemplo: 7x7, 4x3, administrativo"
          />

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
            onChange={(_event, value: CommercialTab) => setActiveTab(value)}
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

          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField
              label={`Buscar en ${tabLabels[activeTab].toLowerCase()}`}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              fullWidth
              placeholder="Nombre, RUT, correo, teléfono, minera, área o subárea"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: colors.text.muted }} />
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Button
              variant="outlined"
              onClick={() => setSearchTerm("")}
              disabled={!searchTerm}
              sx={{ minWidth: { xs: "100%", md: 120 } }}
            >
              Limpiar
            </Button>
          </Stack>
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

      <SmartDataGrid
        rows={activeRows as GridValidRowModel[]}
        columns={columns}
        loading={loading}
      />

      <Dialog
        open={Boolean(createDialog)}
        onClose={closeCreateDialog}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          Crear{" "}
          {createDialog ? tabLabels[createDialog].slice(0, -1) : "registro"}
        </DialogTitle>

        <DialogContent>{renderCreateDialogContent()}</DialogContent>

        <DialogActions>
          <Button onClick={closeCreateDialog} disabled={saving}>
            Cancelar
          </Button>

          <Button
            variant="contained"
            onClick={() => void handleCreate()}
            disabled={saving || !canSaveCreate()}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
