import type { ReactNode } from "react";

import { getStoredAccess } from "../services/authService";

type CapabilityGateProps = {
  capability: string;
  fallback?: ReactNode;
  children: ReactNode;
};

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
