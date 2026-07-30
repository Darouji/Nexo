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

    const handleUnauthorized = () => {
      clearStoredAuth();
      setUser(null);
      setBootstrapping(false);
    };

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
