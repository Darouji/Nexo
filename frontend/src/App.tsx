import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { appTheme } from "./theme/theme";
import { AppRoutes } from "./routes/AppRoutes";

function App() {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <AppRoutes />
    </ThemeProvider>
  );
}

export default App;
