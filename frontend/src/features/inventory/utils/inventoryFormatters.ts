/**
 * Utilidades de presentación y conversión usadas por las secciones de Inventario.
 * Mantienen formatos consistentes sin incorporar reglas de negocio en los componentes.
 */
const chileanNumberFormatter = new Intl.NumberFormat("es-CL");

const chileanDateTimeFormatter = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
});

export function formatNumber(value: number) {
  return chileanNumberFormatter.format(value);
}

export function formatDateTime(value: string) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);

  // Conserva el valor original cuando la API entrega una fecha no interpretable,
  // evitando ocultar información con una fecha inválida generada por el navegador.
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return chileanDateTimeFormatter.format(date);
}

export function parseInteger(value: string, fallback = 0) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
}

/**
 * Traduce el filtro de tres estados de la interfaz al contrato de la API.
 * `undefined` significa que no debe enviarse el filtro, no que el valor sea falso.
 */
export function parseOptionalBoolean(value: string) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}
