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
  createCiudad,
  createAreaCliente,
  createSubAreaCliente,
  createContactoCliente,
  createGrupoEmpresarial,
  createMinera,
  type GrupoEmpresarial,
  type EmpresaCliente,
  type Ciudad,
  type Minera,
  type AreaCliente,
  type SubAreaCliente,
  type ContactoCliente,
  type CreateEmpresaClientePayload,
  type CreateCiudadPayload,
  type CreateAreaClientePayload,
  type CreateSubAreaClientePayload,
  type CreateContactoClientePayload,
  type CreateGrupoEmpresarialPayload,
  type CreateMineraPayload,
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
  const [selectedShiftContact, setSelectedShiftContact] =
    useState<ContactoCliente | null>(null);

  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);

  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [savingContact, setSavingContact] = useState(false);

  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [savingArea, setSavingArea] = useState(false);

  const [subAreaDialogOpen, setSubAreaDialogOpen] = useState(false);
  const [savingSubArea, setSavingSubArea] = useState(false);

  const [cityDialogOpen, setCityDialogOpen] = useState(false);
  const [savingCity, setSavingCity] = useState(false);

  const [businessGroupDialogOpen, setBusinessGroupDialogOpen] = useState(false);
  const [savingBusinessGroup, setSavingBusinessGroup] = useState(false);

  const [miningCompanyDialogOpen, setMiningCompanyDialogOpen] = useState(false);
  const [savingMiningCompany, setSavingMiningCompany] = useState(false);

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

  const [cityForm, setCityForm] = useState<CreateCiudadPayload>({
    name: "",
    region: "",
    status: "ACTIVO",
  });

  const [areaForm, setAreaForm] = useState<CreateAreaClientePayload>({
    company: 0,
    name: "",
    location: "",
    description: "",
    status: "ACTIVO",
  });

  const [subAreaForm, setSubAreaForm] = useState<CreateSubAreaClientePayload>({
    area: 0,
    name: "",
    description: "",
    status: "ACTIVO",
  });

  const [businessGroupForm, setBusinessGroupForm] =
    useState<CreateGrupoEmpresarialPayload>({
      name: "",
      description: "",
      status: "ACTIVO",
    });

  const [miningCompanyForm, setMiningCompanyForm] =
    useState<CreateMineraPayload>({
      name: "",
      business_group: null,
      rut: "",
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
      company.email,
      company.phone,
      company.address,
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

  const filteredAreas = clientAreas.filter((area) =>
    [area.name, area.company_name, area.location, area.description, area.status]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
  );

  const filteredSubAreas = clientSubAreas.filter((subArea) =>
    [
      subArea.name,
      subArea.area_name,
      subArea.company_name,
      subArea.description,
      subArea.status,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
  );

  const filteredBusinessGroups = businessGroups.filter((businessGroup) =>
    [businessGroup.name, businessGroup.description, businessGroup.status]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
  );

  const filteredMiningCompanies = miningCompanies.filter((miningCompany) =>
    [
      miningCompany.name,
      miningCompany.business_group_name,
      miningCompany.rut,
      miningCompany.observations,
      miningCompany.status,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
  );

  const filteredCities = cities.filter((city) =>
    [city.name, city.region, city.status]
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

  async function handleCreateSubArea() {
    try {
      setSavingSubArea(true);
      setError("");

      const createdSubArea = await createSubAreaCliente(subAreaForm);

      setClientSubAreas((currentSubAreas) => [
        ...currentSubAreas,
        createdSubArea,
      ]);

      setSubAreaForm({
        area: 0,
        name: "",
        description: "",
        status: "ACTIVO",
      });

      setSubAreaDialogOpen(false);
    } catch {
      setError("No se pudo crear la subárea cliente.");
    } finally {
      setSavingSubArea(false);
    }
  }

  async function handleCreateCity() {
    try {
      setSavingCity(true);
      setError("");

      const createdCity = await createCiudad(cityForm);

      setCities((currentCities) => [...currentCities, createdCity]);

      setCityForm({
        name: "",
        region: "",
        status: "ACTIVO",
      });

      setCityDialogOpen(false);
    } catch {
      setError("No se pudo crear la ciudad.");
    } finally {
      setSavingCity(false);
    }
  }

  async function handleCreateBusinessGroup() {
    try {
      setSavingBusinessGroup(true);
      setError("");

      const createdBusinessGroup =
        await createGrupoEmpresarial(businessGroupForm);

      setBusinessGroups((currentBusinessGroups) => [
        ...currentBusinessGroups,
        createdBusinessGroup,
      ]);

      setBusinessGroupForm({
        name: "",
        description: "",
        status: "ACTIVO",
      });

      setBusinessGroupDialogOpen(false);
    } catch {
      setError("No se pudo crear el grupo empresarial.");
    } finally {
      setSavingBusinessGroup(false);
    }
  }

  async function handleCreateMiningCompany() {
    try {
      setSavingMiningCompany(true);
      setError("");

      const createdMiningCompany = await createMinera({
        ...miningCompanyForm,
        business_group: miningCompanyForm.business_group || null,
        rut: miningCompanyForm.rut || null,
      });

      setMiningCompanies((currentMiningCompanies) => [
        ...currentMiningCompanies,
        createdMiningCompany,
      ]);

      setMiningCompanyForm({
        name: "",
        business_group: null,
        rut: "",
        status: "ACTIVO",
        observations: "",
      });

      setMiningCompanyDialogOpen(false);
    } catch {
      setError("No se pudo crear la minera.");
    } finally {
      setSavingMiningCompany(false);
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
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Buscar en clientes"
              placeholder="Buscar empresa, contacto, minera, grupo, área, turno..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </Stack>
        </CardContent>
      </Card>

      <Card elevation={0}>
        <CardContent>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              onClick={() => setBusinessGroupDialogOpen(true)}
            >
              Nuevo grupo empresarial
            </Button>

            <Button
              variant="outlined"
              onClick={() => setMiningCompanyDialogOpen(true)}
            >
              Nueva minera
            </Button>

            <Button
              variant="outlined"
              onClick={() => setCompanyDialogOpen(true)}
            >
              Nueva empresa cliente
            </Button>

            <Button variant="outlined" onClick={() => setCityDialogOpen(true)}>
              Nueva ciudad
            </Button>

            <Button variant="outlined" onClick={() => setAreaDialogOpen(true)}>
              Nueva área cliente
            </Button>

            <Button
              variant="outlined"
              onClick={() => setSubAreaDialogOpen(true)}
            >
              Nueva subárea cliente
            </Button>

            <Button
              variant="outlined"
              onClick={() => setContactDialogOpen(true)}
            >
              Nuevo contacto cliente
            </Button>
          </Stack>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="Grupos empresariales" />
            <Tab label="Mineras" />
            <Tab label="Empresas cliente" />
            <Tab label="Ciudades" />
            <Tab label="Áreas cliente" />
            <Tab label="Subáreas cliente" />
            <Tab label="Contactos cliente" />
          </Tabs>
        </CardContent>
      </Card>

      {activeTab === 0 && (
        <Card elevation={0}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Grupos empresariales
            </Typography>

            <TableContainer component={Paper} elevation={0}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Grupo empresarial</TableCell>
                    <TableCell>Descripción</TableCell>
                    <TableCell>Estado</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {filteredBusinessGroups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3}>
                        <Typography color="text.secondary">
                          No hay grupos empresariales registrados.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBusinessGroups.map((businessGroup) => (
                      <TableRow key={businessGroup.id} hover>
                        <TableCell>{businessGroup.name}</TableCell>
                        <TableCell>
                          {businessGroup.description || "-"}
                        </TableCell>
                        <TableCell>
                          <StatusChip status={businessGroup.status} />
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
              Mineras
            </Typography>

            <TableContainer component={Paper} elevation={0}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Minera</TableCell>
                    <TableCell>Grupo empresarial</TableCell>
                    <TableCell>RUT</TableCell>
                    <TableCell>Observaciones</TableCell>
                    <TableCell>Estado</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {filteredMiningCompanies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography color="text.secondary">
                          No hay mineras registradas.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMiningCompanies.map((miningCompany) => (
                      <TableRow key={miningCompany.id} hover>
                        <TableCell>{miningCompany.name}</TableCell>
                        <TableCell>
                          {miningCompany.business_group_name || "-"}
                        </TableCell>
                        <TableCell>{miningCompany.rut || "-"}</TableCell>
                        <TableCell>
                          {miningCompany.observations || "-"}
                        </TableCell>
                        <TableCell>
                          <StatusChip status={miningCompany.status} />
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

      {activeTab === 2 && (
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
                    <TableCell>Correo</TableCell>
                    <TableCell>Teléfono</TableCell>
                    <TableCell>Dirección</TableCell>
                    <TableCell>Estado</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {filteredCompanies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9}>
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
                        <TableCell>{company.email || "-"}</TableCell>
                        <TableCell>{company.phone || "-"}</TableCell>
                        <TableCell>{company.address || "-"}</TableCell>
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

      {activeTab === 3 && (
        <Card elevation={0}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Ciudades
            </Typography>

            <TableContainer component={Paper} elevation={0}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Ciudad</TableCell>
                    <TableCell>Región</TableCell>
                    <TableCell>Estado</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {filteredCities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3}>
                        <Typography color="text.secondary">
                          No hay ciudades registradas.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCities.map((city) => (
                      <TableRow key={city.id} hover>
                        <TableCell>{city.name}</TableCell>
                        <TableCell>{city.region || "-"}</TableCell>
                        <TableCell>
                          <StatusChip status={city.status} />
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

      {activeTab === 4 && (
        <Card elevation={0}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Áreas cliente
            </Typography>

            <TableContainer component={Paper} elevation={0}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Área</TableCell>
                    <TableCell>Empresa</TableCell>
                    <TableCell>Ubicación</TableCell>
                    <TableCell>Estado</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {filteredAreas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Typography color="text.secondary">
                          No hay áreas cliente registradas.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAreas.map((area) => (
                      <TableRow key={area.id} hover>
                        <TableCell>{area.name}</TableCell>
                        <TableCell>{area.company_name}</TableCell>
                        <TableCell>{area.location || "-"}</TableCell>
                        <TableCell>
                          <StatusChip status={area.status} />
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

      {activeTab === 5 && (
        <Card elevation={0}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Subáreas cliente
            </Typography>

            <TableContainer component={Paper} elevation={0}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Subárea</TableCell>
                    <TableCell>Área</TableCell>
                    <TableCell>Empresa</TableCell>
                    <TableCell>Estado</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {filteredSubAreas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Typography color="text.secondary">
                          No hay subáreas cliente registradas.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSubAreas.map((subArea) => (
                      <TableRow key={subArea.id} hover>
                        <TableCell>{subArea.name}</TableCell>
                        <TableCell>{subArea.area_name}</TableCell>
                        <TableCell>{subArea.company_name}</TableCell>
                        <TableCell>
                          <StatusChip status={subArea.status} />
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

      {activeTab === 6 && (
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
                    <TableCell>Correo</TableCell>
                    <TableCell>Teléfono</TableCell>
                    <TableCell>Modalidad / ciclo</TableCell>
                    <TableCell>Estado turno</TableCell>
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
                        <TableCell>
                          <Button
                            variant="text"
                            size="small"
                            onClick={() => setSelectedShiftContact(contact)}
                            disabled={
                              !contact.active_days ||
                              !contact.rest_days ||
                              !contact.active_cycle_start_date
                            }
                          >
                            {getShiftCycleLabel(contact)}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <ShiftStatusChip
                            status={getShiftStatus(
                              contact,
                              new Date().toISOString().slice(0, 10),
                            )}
                          />
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
        open={businessGroupDialogOpen}
        onClose={() => setBusinessGroupDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Nuevo grupo empresarial</DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nombre del grupo empresarial"
              value={businessGroupForm.name}
              onChange={(event) =>
                setBusinessGroupForm({
                  ...businessGroupForm,
                  name: event.target.value,
                })
              }
              required
              fullWidth
            />

            <TextField
              label="Descripción"
              value={businessGroupForm.description}
              onChange={(event) =>
                setBusinessGroupForm({
                  ...businessGroupForm,
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
          <Button onClick={() => setBusinessGroupDialogOpen(false)}>
            Cancelar
          </Button>

          <Button
            variant="contained"
            onClick={handleCreateBusinessGroup}
            disabled={savingBusinessGroup || !businessGroupForm.name.trim()}
          >
            {savingBusinessGroup ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={miningCompanyDialogOpen}
        onClose={() => setMiningCompanyDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Nueva minera</DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nombre de la minera"
              value={miningCompanyForm.name}
              onChange={(event) =>
                setMiningCompanyForm({
                  ...miningCompanyForm,
                  name: event.target.value,
                })
              }
              required
              fullWidth
            />

            <TextField
              select
              label="Grupo empresarial"
              value={miningCompanyForm.business_group ?? ""}
              onChange={(event) =>
                setMiningCompanyForm({
                  ...miningCompanyForm,
                  business_group: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              fullWidth
            >
              <MenuItem value="">Sin grupo empresarial</MenuItem>
              {businessGroups.map((businessGroup) => (
                <MenuItem key={businessGroup.id} value={businessGroup.id}>
                  {businessGroup.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="RUT"
              value={miningCompanyForm.rut}
              onChange={(event) =>
                setMiningCompanyForm({
                  ...miningCompanyForm,
                  rut: event.target.value,
                })
              }
              fullWidth
            />

            <TextField
              label="Observaciones"
              value={miningCompanyForm.observations}
              onChange={(event) =>
                setMiningCompanyForm({
                  ...miningCompanyForm,
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
          <Button onClick={() => setMiningCompanyDialogOpen(false)}>
            Cancelar
          </Button>

          <Button
            variant="contained"
            onClick={handleCreateMiningCompany}
            disabled={savingMiningCompany || !miningCompanyForm.name.trim()}
          >
            {savingMiningCompany ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={cityDialogOpen}
        onClose={() => setCityDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Nueva ciudad</DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nombre de la ciudad"
              value={cityForm.name}
              onChange={(event) =>
                setCityForm({
                  ...cityForm,
                  name: event.target.value,
                })
              }
              required
              fullWidth
            />

            <TextField
              label="Región"
              value={cityForm.region}
              onChange={(event) =>
                setCityForm({
                  ...cityForm,
                  region: event.target.value,
                })
              }
              fullWidth
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setCityDialogOpen(false)}>Cancelar</Button>

          <Button
            variant="contained"
            onClick={handleCreateCity}
            disabled={savingCity || !cityForm.name.trim()}
          >
            {savingCity ? "Guardando..." : "Guardar"}
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
        open={subAreaDialogOpen}
        onClose={() => setSubAreaDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Nueva subárea cliente</DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Área"
              value={subAreaForm.area || ""}
              onChange={(event) =>
                setSubAreaForm({
                  ...subAreaForm,
                  area: Number(event.target.value),
                })
              }
              required
              fullWidth
            >
              <MenuItem value="">Seleccionar área</MenuItem>
              {clientAreas.map((area) => (
                <MenuItem key={area.id} value={area.id}>
                  {area.company_name} - {area.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Nombre de la subárea"
              value={subAreaForm.name}
              onChange={(event) =>
                setSubAreaForm({
                  ...subAreaForm,
                  name: event.target.value,
                })
              }
              required
              fullWidth
            />

            <TextField
              label="Descripción"
              value={subAreaForm.description}
              onChange={(event) =>
                setSubAreaForm({
                  ...subAreaForm,
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
          <Button onClick={() => setSubAreaDialogOpen(false)}>Cancelar</Button>

          <Button
            variant="contained"
            onClick={handleCreateSubArea}
            disabled={
              savingSubArea || !subAreaForm.area || !subAreaForm.name.trim()
            }
          >
            {savingSubArea ? "Guardando..." : "Guardar"}
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

      <Dialog
        open={Boolean(selectedShiftContact)}
        onClose={() => setSelectedShiftContact(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Calendario de turno</DialogTitle>

        <DialogContent>
          {selectedShiftContact && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="subtitle1">
                {selectedShiftContact.full_name}
              </Typography>

              <Typography color="text.secondary">
                {getShiftCycleLabel(selectedShiftContact)}
              </Typography>

              <Grid container spacing={1}>
                {getShiftCalendarDays(selectedShiftContact, 30).map((day) => (
                  <Grid size={{ xs: 3, sm: 2 }} key={day.date}>
                    <Chip
                      label={day.label}
                      color={day.status === "EN_TURNO" ? "success" : "error"}
                      variant="outlined"
                      sx={{ width: "100%" }}
                    />
                  </Grid>
                ))}
              </Grid>
            </Stack>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setSelectedShiftContact(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

type ShiftStatus = "EN_TURNO" | "DESCANSO" | "SIN_TURNO";

function getShiftStatus(
  contact: ContactoCliente,
  queryDate: string,
): ShiftStatus {
  if (
    !contact.active_days ||
    !contact.rest_days ||
    !contact.active_cycle_start_date
  ) {
    return "SIN_TURNO";
  }

  const activeDays = contact.active_days;
  const restDays = contact.rest_days;
  const cycleDays = activeDays + restDays;

  if (cycleDays <= 0) {
    return "SIN_TURNO";
  }

  const selectedDate = new Date(`${queryDate}T00:00:00`);
  const startDate = new Date(`${contact.active_cycle_start_date}T00:00:00`);

  selectedDate.setHours(0, 0, 0, 0);
  startDate.setHours(0, 0, 0, 0);

  const diffMs = selectedDate.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const dayInCycle = ((diffDays % cycleDays) + cycleDays) % cycleDays;

  return dayInCycle < activeDays ? "EN_TURNO" : "DESCANSO";
}

function getShiftStatusLabel(status: ShiftStatus) {
  if (status === "EN_TURNO") return "En turno";
  if (status === "DESCANSO") return "Descanso";
  return "Sin turno";
}

function getShiftCycleLabel(contact: ContactoCliente) {
  if (!contact.active_days || !contact.rest_days) {
    return contact.shift_mode_display || "Sin modalidad";
  }

  const cycleLabel = `${contact.active_days}x${contact.rest_days}`;

  if (!contact.shift_mode_display || contact.shift_mode === "SIN_DEFINIR") {
    return cycleLabel;
  }

  return `${contact.shift_mode_display} · ${cycleLabel}`;
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

type ShiftStatusChipProps = {
  status: ShiftStatus;
};

function ShiftStatusChip({ status }: ShiftStatusChipProps) {
  const label = getShiftStatusLabel(status);

  const color =
    status === "EN_TURNO"
      ? "success"
      : status === "DESCANSO"
        ? "warning"
        : "default";

  return <Chip size="small" label={label} color={color} variant="outlined" />;
}

function getShiftCalendarDays(contact: ContactoCliente, daysToShow: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: daysToShow }, (_, index) => {
    const currentDate = new Date(today);
    currentDate.setDate(today.getDate() + index);

    const isoDate = currentDate.toISOString().slice(0, 10);
    const status = getShiftStatus(contact, isoDate);

    const day = String(currentDate.getDate()).padStart(2, "0");
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");

    return {
      date: isoDate,
      label: `${day}/${month}`,
      status,
    };
  });
}
