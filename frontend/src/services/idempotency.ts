/**
 * Genera una clave única para operaciones que pueden reenviarse por doble clic,
 * reintentos de red o recuperación de una solicitud interrumpida.
 *
 * La clave identifica el intento desde el frontend; la protección efectiva contra
 * efectos duplicados debe ser validada por el endpoint y su servicio de dominio.
 */
export function createIdempotencyKey(scope: string) {
  const normalizedScope = scope.trim() || "operation";

  // randomUUID entrega la opción preferente cuando el navegador la soporta.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${normalizedScope}-${crypto.randomUUID()}`;
  }

  // Mantiene compatibilidad con navegadores sin randomUUID sin bloquear la operación.
  return `${normalizedScope}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}
