import { defineConfig } from "vite";
import react from "@vitejs/plugin-react"; // Mantenlo según el framework que uses (vue, svelte, etc.)

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true,
  },
});
