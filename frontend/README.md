# Nexo · Frontend

Interfaz React y TypeScript del ERP/CRM. Consulta el [README principal](../README.md) para instalar y ejecutar la aplicación completa.

```sh
npm ci
npm run dev
npm run lint
npm test
npm run build
```

Requiere el backend local en `127.0.0.1:8000`. Vite redirige `/api` automáticamente. Para otra URL utiliza `VITE_API_BASE_URL`; las variables `VITE_` son públicas y nunca deben contener secretos.
