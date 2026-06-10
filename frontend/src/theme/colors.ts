// Design Tokens - Paleta "Cyberpunk Profesional" (Sin Azules Estándar)
export const colors = {
  background: {
    main: "#0A0A0F", // Fondo oscuro absoluto para mitigar fatiga visual
    paper: "#12121A", // Contenedores, tarjetas y fondo de la Malla de datos
    header: "#181824", // Barra superior de navegación unificada
  },
  primary: {
    main: "#E000B8", // Magenta Cyberpunk plano (Acentos del menú activo y selección)
    hover: "#B50095",
    activeTab: "rgba(224, 0, 184, 0.08)",
    contrastText: "#FFFFFF",
  },
  secondary: {
    main: "#FF6200", // Naranja de advertencia o botones de acción secundaria
    hover: "#D15000",
    contrastText: "#FFFFFF",
  },
  accent: {
    main: "#00FF88", // Verde neón plano para confirmaciones o éxitos
    hover: "#00D16F",
    contrastText: "#000000",
  },
  status: {
    success: "#00FF88", // Cumple semáforo de faena operativo
    error: "#FF0055",
    warning: "#FFAA00",
    info: "#A300FF", // Púrpura profundo para elementos informativos alternos
  },
  text: {
    primary: "#FFFFFF", // Blanco puro (Esencial para la óptima lectura de mayores de 50 años)
    secondary: "#A9AFC2", // Gris claro de alto contraste para etiquetas descriptivas
    muted: "#545866",
  },
  border: {
    light: "#222333", // Separadores sutiles pero visibles para delimitar celdas tipo Excel
    focus: "#E000B8",
  },
};
