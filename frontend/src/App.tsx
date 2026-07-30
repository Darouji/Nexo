import { useEffect } from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { appTheme } from "./theme/theme";
import { AppRoutes } from "./routes/AppRoutes";
import { applyFontScale, getStoredFontScale } from "./services/accessibilityPreference";

function App() {
  useEffect(() => {
    applyFontScale(getStoredFontScale());
  }, []);

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <AppRoutes />
    </ThemeProvider>
  );
}

export default App;
