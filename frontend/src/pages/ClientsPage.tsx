import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import {
  getGruposEmpresariales,
  getCiudades,
  getEmpresasCliente,
  getMineras,
  getAreasCliente,
  getSubAreasCliente,
  getContactosCliente,
  createEmpresaCliente,
  createContactoCliente,
  createAreaCliente,
  type GrupoEmpresarial,
  type Ciudad,
  type EmpresaCliente,
  type Minera,
  type AreaCliente,
  type SubAreaCliente,
  type ContactoCliente,
  type CreateEmpresaClientePayload,
  type CreateContactoClientePayload,
  type CreateAreaClientePayload,
} from "../services/commercialService";

export function ClientsPage() {
  const [businessGroups, setBusinessGroups] = useState<GrupoEmpresarial[]>([]);
  const [cities, setCities] = useState<Ciudad[]>([]);
  const [miningCompanies, setMiningCompanies] = useState<Minera[]>([]);
  const [clientCompanies, setClientCompanies] = useState<EmpresaCliente[]>([]);
  const [clientAreas, setClientAreas] = useState<AreaCliente[]>([]);
  const [clientSubAreas, setClientSubAreas] = useState<SubAreaCliente[]>([]);
  const [clientContacts, setClientContacts] = useState<ContactoCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState(0);

  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);

  const [companyForm, setCompanyForm] = useState<CreateEmpresaClientePayload>({
    name: "",
    rut: "",
    mining_company: null,
    city: null,
    email: "",
    phone: "",
    address: "",
    status: "ACTIVO",
    observations: "",
  });

  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [savingContact, setSavingContact] = useState(false);

  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [savingArea, setSavingArea] = useState(false);

  const [areaForm, setAreaForm] = useState<CreateAreaClientePayload>({
    company: 0,
    name: "",
    location: "",
    description: "",
    status: "ACTIVO",
  });

  const [contactForm, setContactForm] = useState<CreateContactoClientePayload>({
    first_name: "",
    last_name: "",
    position: "",
    company: 0,
    city: null,
    area: null,
    subarea: null,
    email: "",
    phone: "",
    shift: "",
    active_days: null,
    rest_days: null,
    active_cycle_start_date: null,
    shift_mode: "SIN_DEFINIR",
    status: "ACTIVO",
    observations: "",
  });

  useEffect(() => {
    async function loadCommercialData() {
      try {
        setLoading(true);
        setError("");

        const [
          groupsData,
          citiesData,
          miningData,
          companiesData,
          areasData,
          subAreasData,
          contactsData,
        ] = await Promise.all([
          getGruposEmpresariales(),
          getCiudades(),
          getMineras(),
          getEmpresasCliente(),
          getAreasCliente(),
          getSubAreasCliente(),
          getContactosCliente(),
        ]);

        setBusinessGroups(groupsData);
        setCities(citiesData);
        setMiningCompanies(miningData);
        setClientCompanies(companiesData);
        setClientAreas(areasData);
        setClientSubAreas(subAreasData);
        setClientContacts(contactsData);
      } catch {
        setError("No se pudo cargar la información comercial.");
      } finally {
        setLoading(false);
      }
    }

    loadCommercialData();
  }, []);

  if (loading) {
    return (
      <Stack spacing={2} sx={{ alignItems: "center" }}>
        <CircularProgress />
        <Typography color="text.secondary">Cargando clientes...</Typography>
      </Stack>
    );
  }

  const normalizedSearch = searchTerm.toLowerCase().trim();

  const filteredCompanies = clientCompanies.filter((company) =>
    [
      company.name,
      company.rut,
      company.mining_company_name,
      company.business_group_name,
      company.city_name,
      company.phone,
      company.status,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
  );

  const filteredContacts = clientContacts.filter((contact) =>
    [
      contact.full_name,
      contact.company_name,
      contact.city_name,
      contact.area_name,
      contact.subarea_name,
      contact.position,
      contact.email,
      contact.phone,
      contact.shift,
      contact.shift_mode_display,
      contact.status,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
  );

  async function handleCreateCompany() {
    try {
      setSavingCompany(true);
      setError("");

      const createdCompany = await createEmpresaCliente({
        ...companyForm,
        mining_company: companyForm.mining_company || null,
        city: companyForm.city || null,
      });

      setClientCompanies((currentCompanies) => [
        ...currentCompanies,
        createdCompany,
      ]);

      setCompanyForm({
        name: "",
        rut: "",
        mining_company: null,
        city: null,
        email: "",
        phone: "",
        address: "",
        status: "ACTIVO",
        observations: "",
      });

      setCompanyDialogOpen(false);
    } catch {
      setError("No se pudo crear la empresa cliente.");
    } finally {
      setSavingCompany(false);
    }
  }

  async function handleCreateContact() {
    try {
      setSavingContact(true);
      setError("");

      const createdContact = await createContactoCliente({
        ...contactForm,
        city: contactForm.city || null,
        area: contactForm.area || null,
        subarea: contactForm.subarea || null,
        active_days: contactForm.active_days || null,
        rest_days: contactForm.rest_days || null,
        active_cycle_start_date: contactForm.active_cycle_start_date || null,
        shift_mode: contactForm.shift_mode || "SIN_DEFINIR",
      });

      setClientContacts((currentContacts) => [
        ...currentContacts,
        createdContact,
      ]);

      setContactForm({
        first_name: "",
        last_name: "",
        position: "",
        company: 0,
        city: null,
        area: null,
        subarea: null,
        email: "",
        phone: "",
        shift: "",
        active_days: null,
        rest_days: null,
        active_cycle_start_date: null,
        shift_mode: "SIN_DEFINIR",
        status: "ACTIVO",
        observations: "",
      });

      setContactDialogOpen(false);
    } catch {
      setError("No se pudo crear el contacto cliente.");
    } finally {
      setSavingContact(false);
    }
  }

  async function handleCreateArea() {
    try {
      setSavingArea(true);
      setError("");

      const createdArea = await createAreaCliente(areaForm);

      setClientAreas((currentAreas) => [...currentAreas, createdArea]);

      setAreaForm({
        company: 0,
        name: "",
        location: "",
        description: "",
        status: "ACTIVO",
      });

      setAreaDialogOpen(false);
    } catch {
      setError("No se pudo crear el área cliente.");
    } finally {
      setSavingArea(false);
    }
  }

  return (
    <Stack spacing={3}>
      <Card elevation={0}>
        <CardContent>
          <Typography variant="h4" component="h1" gutterBottom>
            Clientes
          </Typography>

          <Typography color="text.secondary">
            Módulo comercial base: grupos empresariales, mineras, empresas,
            áreas y contactos cliente.
          </Typography>
        </CardContent>
      </Card>

      {error && <Alert severity="error">{error}</Alert>}

      <Grid container spacing={3}>
        <SummaryCard
          title="Grupos empresariales"
          value={businessGroups.length}
        />
        <SummaryCard title="Ciudades" value={cities.length} />
        <SummaryCard title="Mineras" value={miningCompanies.length} />
        <SummaryCard title="Empresas cliente" value={clientCompanies.length} />
        <SummaryCard title="Áreas cliente" value={clientAreas.length} />
        <SummaryCard title="Subáreas cliente" value={clientSubAreas.length} />
        <SummaryCard title="Contactos cliente" value={clientContacts.length} />
      </Grid>

      <Card elevation={0}>
        <CardContent>
          <TextField
            fullWidth
            label="Buscar en clientes"
            placeholder="Buscar empresa, contacto, minera, grupo, área, turno..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </CardContent>
      </Card>

      <Card elevation={0}>
        <CardContent>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              onClick={() => setCompanyDialogOpen(true)}
            >
              Nueva empresa cliente
            </Button>

            <Button
              variant="outlined"
              onClick={() => setContactDialogOpen(true)}
            >
              Nuevo contacto cliente
            </Button>
            <Button variant="outlined" onClick={() => setAreaDialogOpen(true)}>
              Nueva área cliente
            </Button>
          </Stack>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
          >
            <Tab label="Empresas cliente" />
            <Tab label="Contactos cliente" />
          </Tabs>
        </CardContent>
      </Card>

      {activeTab === 0 && (
        <Card elevation={0}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Empresas cliente
            </Typography>

            <TableContainer component={Paper} elevation={0}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Empresa</TableCell>
                    <TableCell>RUT</TableCell>
                    <TableCell>Minera</TableCell>
                    <TableCell>Grupo</TableCell>
                    <TableCell>Ciudad</TableCell>
                    <TableCell>Teléfono</TableCell>
                    <TableCell>Estado</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {filteredCompanies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <Typography color="text.secondary">
                          No hay empresas cliente registradas.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCompanies.map((company) => (
                      <TableRow key={company.id} hover>
                        <TableCell>{company.name}</TableCell>
                        <TableCell>{company.rut || "-"}</TableCell>
                        <TableCell>
                          {company.mining_company_name || "-"}
                        </TableCell>
                        <TableCell>
                          {company.business_group_name || "-"}
                        </TableCell>
                        <TableCell>{company.city_name || "-"}</TableCell>
                        <TableCell>{company.phone || "-"}</TableCell>
                        <TableCell>
                          <StatusChip status={company.status} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {activeTab === 1 && (
        <Card elevation={0}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Contactos cliente
            </Typography>

            <TableContainer component={Paper} elevation={0}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Nombre</TableCell>
                    <TableCell>Empresa</TableCell>
                    <TableCell>Ciudad</TableCell>
                    <TableCell>Área</TableCell>
                    <TableCell>Subárea</TableCell>
                    <TableCell>Cargo</TableCell>
                    <TableCell>Teléfono</TableCell>
                    <TableCell>Correo</TableCell>
                    <TableCell>Turno</TableCell>
                    <TableCell>Modalidad</TableCell>
                    <TableCell>Estado</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {filteredContacts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11}>
                        <Typography color="text.secondary">
                          No hay contactos cliente registrados.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredContacts.map((contact) => (
                      <TableRow key={contact.id} hover>
                        <TableCell>{contact.full_name}</TableCell>
                        <TableCell>{contact.company_name}</TableCell>
                        <TableCell>{contact.city_name || "-"}</TableCell>
                        <TableCell>{contact.area_name || "-"}</TableCell>
                        <TableCell>{contact.subarea_name || "-"}</TableCell>
                        <TableCell>{contact.position || "-"}</TableCell>
                        <TableCell>{contact.email || "-"}</TableCell>
                        <TableCell>{contact.phone || "-"}</TableCell>
                        <TableCell>{contact.shift || "-"}</TableCell>
                        <TableCell>
                          {contact.shift_mode_display || "-"}
                        </TableCell>
                        <TableCell>
                          <StatusChip status={contact.status} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
      <Dialog
        open={companyDialogOpen}
        onClose={() => setCompanyDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Nueva empresa cliente</DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nombre / Razón social"
              value={companyForm.name}
              onChange={(event) =>
                setCompanyForm({ ...companyForm, name: event.target.value })
              }
              required
              fullWidth
            />

            <TextField
              label="RUT"
              value={companyForm.rut}
              onChange={(event) =>
                setCompanyForm({ ...companyForm, rut: event.target.value })
              }
              fullWidth
            />

            <TextField
              select
              label="Minera relacionada"
              value={companyForm.mining_company ?? ""}
              onChange={(event) =>
                setCompanyForm({
                  ...companyForm,
                  mining_company: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              fullWidth
            >
              <MenuItem value="">Sin minera</MenuItem>
              {miningCompanies.map((miningCompany) => (
                <MenuItem key={miningCompany.id} value={miningCompany.id}>
                  {miningCompany.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Ciudad"
              value={companyForm.city ?? ""}
              onChange={(event) =>
                setCompanyForm({
                  ...companyForm,
                  city: event.target.value ? Number(event.target.value) : null,
                })
              }
              fullWidth
            >
              <MenuItem value="">Sin ciudad</MenuItem>
              {cities.map((city) => (
                <MenuItem key={city.id} value={city.id}>
                  {city.name}
                  {city.region ? ` - ${city.region}` : ""}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Correo"
              value={companyForm.email}
              onChange={(event) =>
                setCompanyForm({ ...companyForm, email: event.target.value })
              }
              fullWidth
            />

            <TextField
              label="Teléfono"
              value={companyForm.phone}
              onChange={(event) =>
                setCompanyForm({ ...companyForm, phone: event.target.value })
              }
              fullWidth
            />

            <TextField
              label="Dirección"
              value={companyForm.address}
              onChange={(event) =>
                setCompanyForm({ ...companyForm, address: event.target.value })
              }
              fullWidth
            />

            <TextField
              label="Observaciones"
              value={companyForm.observations}
              onChange={(event) =>
                setCompanyForm({
                  ...companyForm,
                  observations: event.target.value,
                })
              }
              multiline
              minRows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setCompanyDialogOpen(false)}>Cancelar</Button>

          <Button
            variant="contained"
            onClick={handleCreateCompany}
            disabled={savingCompany || !companyForm.name.trim()}
          >
            {savingCompany ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={areaDialogOpen}
        onClose={() => setAreaDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Nueva área cliente</DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Empresa"
              value={areaForm.company || ""}
              onChange={(event) =>
                setAreaForm({
                  ...areaForm,
                  company: Number(event.target.value),
                })
              }
              required
              fullWidth
            >
              <MenuItem value="">Seleccionar empresa</MenuItem>
              {clientCompanies.map((company) => (
                <MenuItem key={company.id} value={company.id}>
                  {company.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Nombre del área"
              value={areaForm.name}
              onChange={(event) =>
                setAreaForm({ ...areaForm, name: event.target.value })
              }
              required
              fullWidth
            />

            <TextField
              label="Ubicación"
              value={areaForm.location}
              onChange={(event) =>
                setAreaForm({ ...areaForm, location: event.target.value })
              }
              fullWidth
            />

            <TextField
              label="Descripción"
              value={areaForm.description}
              onChange={(event) =>
                setAreaForm({
                  ...areaForm,
                  description: event.target.value,
                })
              }
              multiline
              minRows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setAreaDialogOpen(false)}>Cancelar</Button>

          <Button
            variant="contained"
            onClick={handleCreateArea}
            disabled={savingArea || !areaForm.company || !areaForm.name.trim()}
          >
            {savingArea ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={contactDialogOpen}
        onClose={() => setContactDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Nuevo contacto cliente</DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nombres"
              value={contactForm.first_name}
              onChange={(event) =>
                setContactForm({
                  ...contactForm,
                  first_name: event.target.value,
                })
              }
              required
              fullWidth
            />

            <TextField
              label="Apellidos"
              value={contactForm.last_name}
              onChange={(event) =>
                setContactForm({
                  ...contactForm,
                  last_name: event.target.value,
                })
              }
              fullWidth
            />

            <TextField
              select
              label="Empresa"
              value={contactForm.company || ""}
              onChange={(event) =>
                setContactForm({
                  ...contactForm,
                  company: Number(event.target.value),
                  area: null,
                  subarea: null,
                })
              }
              required
              fullWidth
            >
              <MenuItem value="">Seleccionar empresa</MenuItem>
              {clientCompanies.map((company) => (
                <MenuItem key={company.id} value={company.id}>
                  {company.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Ciudad"
              value={contactForm.city ?? ""}
              onChange={(event) =>
                setContactForm({
                  ...contactForm,
                  city: event.target.value ? Number(event.target.value) : null,
                })
              }
              fullWidth
            >
              <MenuItem value="">Sin ciudad</MenuItem>
              {cities.map((city) => (
                <MenuItem key={city.id} value={city.id}>
                  {city.name}
                  {city.region ? ` - ${city.region}` : ""}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Área"
              value={contactForm.area ?? ""}
              onChange={(event) =>
                setContactForm({
                  ...contactForm,
                  area: event.target.value ? Number(event.target.value) : null,
                  subarea: null,
                })
              }
              fullWidth
              disabled={!contactForm.company}
            >
              <MenuItem value="">Sin área</MenuItem>
              {clientAreas
                .filter((area) => area.company === contactForm.company)
                .map((area) => (
                  <MenuItem key={area.id} value={area.id}>
                    {area.name}
                  </MenuItem>
                ))}
            </TextField>

            <TextField
              select
              label="Subárea"
              value={contactForm.subarea ?? ""}
              onChange={(event) =>
                setContactForm({
                  ...contactForm,
                  subarea: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              fullWidth
              disabled={!contactForm.area}
            >
              <MenuItem value="">Sin subárea</MenuItem>
              {clientSubAreas
                .filter((subarea) => subarea.area === contactForm.area)
                .map((subarea) => (
                  <MenuItem key={subarea.id} value={subarea.id}>
                    {subarea.name}
                  </MenuItem>
                ))}
            </TextField>

            <TextField
              label="Cargo"
              value={contactForm.position}
              onChange={(event) =>
                setContactForm({ ...contactForm, position: event.target.value })
              }
              fullWidth
            />

            <TextField
              label="Correo"
              value={contactForm.email}
              onChange={(event) =>
                setContactForm({ ...contactForm, email: event.target.value })
              }
              fullWidth
            />

            <TextField
              label="Teléfono"
              value={contactForm.phone}
              onChange={(event) =>
                setContactForm({ ...contactForm, phone: event.target.value })
              }
              fullWidth
            />

            <TextField
              label="Turno"
              value={contactForm.shift}
              onChange={(event) =>
                setContactForm({ ...contactForm, shift: event.target.value })
              }
              fullWidth
            />

            <TextField
              label="Días activos"
              type="number"
              value={contactForm.active_days ?? ""}
              onChange={(event) =>
                setContactForm({
                  ...contactForm,
                  active_days: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              fullWidth
            />

            <TextField
              label="Días descanso"
              type="number"
              value={contactForm.rest_days ?? ""}
              onChange={(event) =>
                setContactForm({
                  ...contactForm,
                  rest_days: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              fullWidth
            />

            <TextField
              label="Fecha inicio ciclo activo"
              type="date"
              value={contactForm.active_cycle_start_date ?? ""}
              onChange={(event) =>
                setContactForm({
                  ...contactForm,
                  active_cycle_start_date: event.target.value || null,
                })
              }
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />

            <TextField
              select
              label="Modalidad"
              value={contactForm.shift_mode ?? "SIN_DEFINIR"}
              onChange={(event) =>
                setContactForm({
                  ...contactForm,
                  shift_mode: event.target.value,
                })
              }
              fullWidth
            >
              <MenuItem value="SIN_DEFINIR">Sin definir</MenuItem>
              <MenuItem value="DIA">Día</MenuItem>
              <MenuItem value="NOCHE">Noche</MenuItem>
            </TextField>

            <TextField
              label="Observaciones"
              value={contactForm.observations}
              onChange={(event) =>
                setContactForm({
                  ...contactForm,
                  observations: event.target.value,
                })
              }
              multiline
              minRows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setContactDialogOpen(false)}>Cancelar</Button>

          <Button
            variant="contained"
            onClick={handleCreateContact}
            disabled={
              savingContact ||
              !contactForm.first_name.trim() ||
              !contactForm.company
            }
          >
            {savingContact ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

type SummaryCardProps = {
  title: string;
  value: number;
};

function SummaryCard({ title, value }: SummaryCardProps) {
  return (
    <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
      <Card elevation={0}>
        <CardContent>
          <Typography color="text.secondary" gutterBottom>
            {title}
          </Typography>

          <Typography variant="h4" component="p">
            {value}
          </Typography>
        </CardContent>
      </Card>
    </Grid>
  );
}

type StatusChipProps = {
  status: string;
};

function StatusChip({ status }: StatusChipProps) {
  const label = status === "ACTIVO" ? "Activo" : "Inactivo";
  const color = status === "ACTIVO" ? "success" : "default";

  return <Chip size="small" label={label} color={color} variant="outlined" />;
}
