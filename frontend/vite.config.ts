import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    restoreMocks: true,
  },

  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,

    // Los hosts externos se autorizan mediante:
    // __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS
    allowedHosts: [],

    // Permite que frontend y backend se publiquen mediante
    // una sola dirección ngrok.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
