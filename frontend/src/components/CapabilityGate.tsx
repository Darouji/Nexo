/**
 * Control visual para acciones específicas de un dominio, como transferir stock
 * o aprobar una compra. Las capacidades provienen del backend y son más precisas
 * que una comparación directa de roles.
 *
 * Este componente no autoriza la operación: el endpoint debe comprobar la misma
 * capacidad antes de ejecutar cualquier cambio.
 */
import type { ReactNode } from "react";

import { getStoredAccess } from "../services/authService";

type CapabilityGateProps = {
  capability: string;
  fallback?: ReactNode;
  children: ReactNode;
};

/** Rechaza claves vacías y consulta únicamente el mapa efectivo de la sesión. */
function hasStoredCapability(capability: string) {
  const normalizedCapability = String(capability || "").trim();

  if (!normalizedCapability) {
    return false;
  }

  return Boolean(
    getStoredAccess()?.capabilities?.[normalizedCapability],
  );
}

export function CapabilityGate({
  capability,
  fallback = null,
  children,
}: CapabilityGateProps) {
  if (!hasStoredCapability(capability)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
