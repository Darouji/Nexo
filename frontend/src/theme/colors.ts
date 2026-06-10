// Design Tokens - Paleta "Cyberpunk Sobrio"
export const colors = {
  // Fondos oscuros (Sin ser negro puro para menor fatiga visual)
  background: {
    main: "#0D0E15", // Fondo principal de la app
    paper: "#151621", // Fondo de tarjetas, modales y menú
    header: "#1A1B28", // Fondo de la barra superior (Omnibox)
  },

  // Acentos Cyberpunk (Planos, sin efecto glow)
  primary: {
    main: "#00F0FF", // Cian eléctrico (Botones primarios, enlaces activos)
    hover: "#00B8C4",
    contrastText: "#000000",
  },
  secondary: {
    main: "#FF0055", // Magenta/Rosado intenso (Notificaciones, botones secundarios)
    hover: "#CC0044",
    contrastText: "#FFFFFF",
  },
  accent: {
    main: "#FCE205", // Amarillo Cyberpunk (Alertas, etiquetas destacadas)
    hover: "#C2AD00",
    contrastText: "#000000",
  },

  // Estados Operativos (Semáforo de Faena y Mallas)
  status: {
    success: "#00FF66", // Verde (En turno, Activo, Pagado)
    error: "#FF003C", // Rojo (Descanso, Inactivo, Vencido)
    warning: "#FF8800", // Naranja (Stock crítico, Excepciones)
    info: "#00A2FF", // Azul (Información general)
  },

  // Textos y bordes
  text: {
    primary: "#E0E4F5", // Texto principal (Casi blanco)
    secondary: "#8B92B2", // Texto secundario (Gris azulado)
    muted: "#4A4E69", // Texto deshabilitado o marcas de agua
  },
  border: {
    light: "#2A2C3D", // Bordes sutiles para separadores de tablas
    focus: "#00F0FF", // Borde activo para inputs
  },
};
