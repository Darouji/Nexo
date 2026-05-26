import { useEffect, useState } from "react";
import axios from "axios";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Stack,
  Typography,
} from "@mui/material";

type HealthResponse = {
  status: string;
  message: string;
  version: string;
};

function App() {
  const [apiStatus, setApiStatus] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const checkApi = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const response = await axios.get<HealthResponse>(
        "http://127.0.0.1:8000/api/health/"
      );

      setApiStatus(response.data);
    } catch (error) {
      setApiStatus(null);
      setErrorMessage("No se pudo conectar con la API de Django.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkApi();
  }, []);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        display: "flex",
        alignItems: "center",
      }}
    >
      <Container maxWidth="md">
        <Card elevation={3}>
          <CardContent>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h4" component="h1" gutterBottom>
                  Serkan Platform V2
                </Typography>

                <Typography color="text.secondary">
                  Base técnica inicial con React, TypeScript, Material UI,
                  Django y Django REST Framework.
                </Typography>
              </Box>

              <Box>
                {loading && <Chip label="Comprobando API..." color="info" />}

                {!loading && apiStatus && (
                  <Stack spacing={1}>
                    <Chip label="Backend conectado" color="success" />
                    <Typography>
                      <strong>Mensaje:</strong> {apiStatus.message}
                    </Typography>
                    <Typography>
                      <strong>Versión:</strong> {apiStatus.version}
                    </Typography>
                  </Stack>
                )}

                {!loading && errorMessage && (
                  <Stack spacing={1}>
                    <Chip label="Backend desconectado" color="error" />
                    <Typography color="error">{errorMessage}</Typography>
                  </Stack>
                )}
              </Box>

              <Box>
                <Button variant="contained" onClick={checkApi}>
                  Probar conexión otra vez
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}

export default App;