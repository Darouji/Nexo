import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  Typography,
} from "@mui/material";
import { getStoredUser, logout } from "../services/authService";

type DashboardPageProps = {
  onLogout: () => void;
};

export function DashboardPage({ onLogout }: DashboardPageProps) {
  const user = getStoredUser();

  const handleLogout = () => {
    logout();
    onLogout();
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        py: 6,
      }}
    >
      <Container maxWidth="md">
        <Card elevation={3}>
          <CardContent>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h4" component="h1" gutterBottom>
                  Dashboard
                </Typography>

                <Typography color="text.secondary">
                  Sesión iniciada correctamente en Serkan Platform V2.
                </Typography>
              </Box>

              {user && (
                <Box>
                  <Typography>
                    <strong>Usuario:</strong> {user.username}
                  </Typography>

                  <Typography>
                    <strong>Rol:</strong> {user.profile?.role_display}
                  </Typography>
                </Box>
              )}

              <Box>
                <Button variant="outlined" color="error" onClick={handleLogout}>
                  Cerrar sesión
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}