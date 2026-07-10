import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    // Escucha únicamente dentro de este computador.
    // No expone Vite directamente a otros dispositivos de la red local.
    host: "127.0.0.1",

    port: 5173,
    strictPort: true,

    // Los dominios adicionales se autorizan mediante
    // __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS.
    allowedHosts: [],
  },
});
