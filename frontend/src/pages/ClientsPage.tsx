import { useEffect, useState } from "react";
import {
  Alert,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Stack,
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
  getAreasCliente,
  getContactosCliente,
  getEmpresasCliente,
  getGruposEmpresariales,
  getMineras,
  type AreaCliente,
  type ContactoCliente,
  type EmpresaCliente,
  type GrupoEmpresarial,
  type Minera,
} from "../services/commercialService";

export function ClientsPage() {
  const [businessGroups, setBusinessGroups] = useState<GrupoEmpresarial[]>([]);
  const [miningCompanies, setMiningCompanies] = useState<Minera[]>([]);
  const [clientCompanies, setClientCompanies] = useState<EmpresaCliente[]>([]);
  const [clientAreas, setClientAreas] = useState<AreaCliente[]>([]);
  const [clientContacts, setClientContacts] = useState<ContactoCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function loadCommercialData() {
      try {
        setLoading(true);
        setError("");

        const [
          groupsData,
          miningData,
          companiesData,
          areasData,
          contactsData,
        ] = await Promise.all([
          getGruposEmpresariales(),
          getMineras(),
          getEmpresasCliente(),
          getAreasCliente(),
          getContactosCliente(),
        ]);

        setBusinessGroups(groupsData);
        setMiningCompanies(miningData);
        setClientCompanies(companiesData);
        setClientAreas(areasData);
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
        company.phone,
        company.status,
    ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch))
    );

    const filteredContacts = clientContacts.filter((contact) =>
    [
        contact.full_name,
        contact.company_name,
        contact.area_name,
        contact.position,
        contact.shift,
        contact.contact_type,
        contact.alliance_level,
        contact.status,
    ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch))
    );

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
        <SummaryCard title="Grupos empresariales" value={businessGroups.length} />
        <SummaryCard title="Mineras" value={miningCompanies.length} />
        <SummaryCard title="Empresas cliente" value={clientCompanies.length} />
        <SummaryCard title="Áreas cliente" value={clientAreas.length} />
        <SummaryCard title="Contactos cliente" value={clientContacts.length} />
      </Grid>

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
                  <TableCell>Teléfono</TableCell>
                  <TableCell>Estado</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {filteredCompanies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
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
                      <TableCell>{company.mining_company_name || "-"}</TableCell>
                      <TableCell>{company.business_group_name || "-"}</TableCell>
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
                  <TableCell>Área</TableCell>
                  <TableCell>Cargo</TableCell>
                  <TableCell>Turno</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Alianza</TableCell>
                  <TableCell>Estado</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {filteredContacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
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
                      <TableCell>{contact.area_name || "-"}</TableCell>
                      <TableCell>{contact.position || "-"}</TableCell>
                      <TableCell>{contact.shift || "-"}</TableCell>
                      <TableCell>{contact.contact_type}</TableCell>
                      <TableCell>{contact.alliance_level}</TableCell>
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