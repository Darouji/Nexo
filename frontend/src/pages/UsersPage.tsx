import { useState } from "react";
import type { SyntheticEvent } from "react";
import axios from "axios";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { createUser } from "../services/userService";
import type { CreateUserPayload } from "../services/userService";
import type { AuthUser } from "../types/auth";

type UsersPageProps = {
  currentUser: AuthUser | null;
};

const roleOptions = [
  {
    value: "ADMINISTRADOR",
    label: "Administrador",
    onlyAdmin: true,
  },
  {
    value: "RRHH",
    label: "RRHH",
    onlyAdmin: false,
  },
  {
    value: "INFORMATICO",
    label: "Informático",
    onlyAdmin: false,
  },
  {
    value: "FINANZAS_COMERCIAL",
    label: "Finanzas / Comercial",
    onlyAdmin: false,
  },
  {
    value: "OPERATIVO",
    label: "Operativo",
    onlyAdmin: false,
  },
  {
    value: "CONSULTA",
    label: "Consulta",
    onlyAdmin: false,
  },
];

const initialForm: CreateUserPayload = {
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  password: "",
  role: "OPERATIVO",
  phone: "",
  position: "",
  area: "",
};

export function UsersPage({ currentUser }: UsersPageProps) {
  const [form, setForm] = useState<CreateUserPayload>(initialForm);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const currentRole = currentUser?.role;
  const canCreateAdmin = currentRole === "ADMINISTRADOR";

  const availableRoles = roleOptions.filter((role) => {
    if (role.onlyAdmin) {
      return canCreateAdmin;
    }

    return true;
  });

  const updateField = (field: keyof CreateUserPayload, value: string) => {
    setForm((previousForm) => ({
      ...previousForm,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setLoading(true);
      setSuccessMessage("");
      setErrorMessage("");

      const response = await createUser(form);

      setSuccessMessage(response.detail);
      setForm(initialForm);
    } catch (error: unknown) {
      let detail = "No se pudo crear el usuario.";

      if (axios.isAxiosError(error)) {
        const data = error.response?.data;

        if (typeof data === "string") {
          detail = data;
        } else if (data?.detail) {
          detail = data.detail;
        } else if (data && typeof data === "object") {
          detail = Object.entries(data)
            .map(([field, messages]) => {
              if (Array.isArray(messages)) {
                return `${field}: ${messages.join(", ")}`;
              }

              return `${field}: ${String(messages)}`;
            })
            .join(" | ");
        }
      }

      setErrorMessage(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          Gestión de usuarios
        </Typography>

        <Typography color="text.secondary">
          Crea cuentas internas para los usuarios de Serkan. Solo Administrador
          y RRHH pueden crear usuarios. Solo Administrador puede crear otro
          Administrador.
        </Typography>
      </Box>

      <Card elevation={0}>
        <CardContent>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h6">Crear nuevo usuario</Typography>
              <Typography variant="body2" color="text.secondary">
                Completa los datos principales de la cuenta.
              </Typography>
            </Box>

            {successMessage && (
              <Alert severity="success">{successMessage}</Alert>
            )}

            {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

            <Box component="form" onSubmit={handleSubmit}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Usuario"
                    value={form.username}
                    onChange={(event) =>
                      updateField("username", event.target.value)
                    }
                    fullWidth
                    required
                    autoComplete="username"
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Correo"
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      updateField("email", event.target.value)
                    }
                    fullWidth
                    autoComplete="email"
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Nombres"
                    value={form.first_name}
                    onChange={(event) =>
                      updateField("first_name", event.target.value)
                    }
                    fullWidth
                    autoComplete="given-name"
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Apellidos"
                    value={form.last_name}
                    onChange={(event) =>
                      updateField("last_name", event.target.value)
                    }
                    fullWidth
                    autoComplete="family-name"
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Contraseña temporal"
                    type="password"
                    value={form.password}
                    onChange={(event) =>
                      updateField("password", event.target.value)
                    }
                    fullWidth
                    required
                    autoComplete="new-password"
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Rol"
                    value={form.role}
                    onChange={(event) =>
                      updateField("role", event.target.value)
                    }
                    select
                    fullWidth
                    required
                  >
                    {availableRoles.map((role) => (
                      <MenuItem key={role.value} value={role.value}>
                        {role.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    label="Teléfono"
                    value={form.phone}
                    onChange={(event) =>
                      updateField("phone", event.target.value)
                    }
                    fullWidth
                    autoComplete="tel"
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    label="Cargo"
                    value={form.position}
                    onChange={(event) =>
                      updateField("position", event.target.value)
                    }
                    fullWidth
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    label="Área"
                    value={form.area}
                    onChange={(event) =>
                      updateField("area", event.target.value)
                    }
                    fullWidth
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Button type="submit" variant="contained" disabled={loading}>
                    {loading ? "Creando usuario..." : "Crear usuario"}
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
