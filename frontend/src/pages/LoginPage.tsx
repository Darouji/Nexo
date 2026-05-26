import { useState } from "react";
import type { SyntheticEvent } from "react";
import axios from "axios";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { login } from "../services/authService";

type LoginPageProps = {
  onLoginSuccess: () => void;
};

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("1234");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setLoading(true);
      setErrorMessage("");

      await login({
        username,
        password,
      });

      onLoginSuccess();
    } catch (error: unknown) {
      let detail = "No se pudo iniciar sesión. Revisa tus credenciales.";

      if (axios.isAxiosError(error)) {
        const data = error.response?.data as { detail?: string } | undefined;
        detail = data?.detail || detail;
      }

      setErrorMessage(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        display: "flex",
        alignItems: "center",
      }}
    >
      <Container maxWidth="sm">
        <Card elevation={3}>
          <CardContent>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h4" component="h1" gutterBottom>
                  Iniciar sesión
                </Typography>

                <Typography color="text.secondary">
                  Accede a Serkan Platform V2 con tu cuenta de usuario.
                </Typography>
              </Box>

              {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

              <Box component="form" onSubmit={handleSubmit}>
                <Stack spacing={2}>
                  <TextField
                    label="Usuario"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    fullWidth
                    required
                    autoComplete="username"
                  />

                  <TextField
                    label="Contraseña"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    fullWidth
                    required
                    autoComplete="current-password"
                  />

                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={loading}
                  >
                    {loading ? "Ingresando..." : "Ingresar"}
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}