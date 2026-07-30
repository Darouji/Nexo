/**
 * Orquesta el arranque de la aplicación y el ciclo de autenticación.
 *
 * Esta capa decide si debe mostrarse la validación inicial, el acceso público o
 * el espacio de trabajo autenticado. También centraliza la invalidación de la
 * sesión para que cualquier respuesta 401 de la API cierre el acceso de forma
 * coherente en toda la plataforma.
 */
import { useEffect, useState } from "react";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { DashboardPage } from "../pages/DashboardPage";
import { WelcomeScreen } from "../components/WelcomeScreen";
import { LoginPage } from "../pages/LoginPage";
import {
  clearStoredAuth,
  fetchAuthSession,
  getStoredToken,
  getStoredUser,
} from "../services/authService";
import { AUTH_UNAUTHORIZED_EVENT } from "../services/api";
import type { AuthUser } from "../types/auth";
import { colors } from "../theme/colors";

function SessionLoadingScreen() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        bgcolor: colors.background.main,
      }}
    >
      <Stack spacing={2} sx={{ alignItems: "center" }}>
        <CircularProgress />
        <Typography sx={{ color: colors.text.secondary, fontWeight: 700 }}>
          Validando sesión segura...
        </Typography>
      </Stack>
    </Box>
  );
}

export function AppRoutes() {
  const [bootstrapping, setBootstrapping] = useState(Boolean(getStoredToken()));
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [welcomeUser, setWelcomeUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let isMounted = true;

    // La capa HTTP emite este evento cuando el backend invalida la sesión. Así
    // se evita que cada pantalla tenga que implementar su propio cierre forzado.
    const handleUnauthorized = () => {
      clearStoredAuth();
      setUser(null);
      setBootstrapping(false);
    };

    // El usuario almacenado permite pintar la interfaz con rapidez, pero el
    // backend sigue siendo la fuente de verdad antes de habilitar la sesión.
    const restoreSession = async () => {
      if (!getStoredToken()) {
        setBootstrapping(false);
        return;
      }

      try {
        const session = await fetchAuthSession();

        if (!isMounted) {
          return;
        }

        setUser(session.user);
      } catch {
        if (!isMounted) {
          return;
        }

        clearStoredAuth();
        setUser(null);
      } finally {
        if (isMounted) {
          setBootstrapping(false);
        }
      }
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    void restoreSession();

    return () => {
      isMounted = false;
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, []);

  if (bootstrapping) {
    return <SessionLoadingScreen />;
  }

  if (!user) {
    return (
      <LoginPage
        onLoginSuccess={(loggedUser) => {
          setWelcomeUser(loggedUser);
          setUser(loggedUser);
        }}
      />
    );
  }

  return (
    <>
      <DashboardPage user={user} onLogout={() => setUser(null)} />
      {welcomeUser ? (
        <WelcomeScreen
          user={welcomeUser}
          onContinue={() => setWelcomeUser(null)}
        />
      ) : null}
    </>
  );
}
