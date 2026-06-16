import type { ReactNode } from "react";
import { getStoredAccess } from "../services/authService";
import type { AuthUser, ModulePermission } from "../types/auth";

type RequiredPermission = keyof Pick<
  ModulePermission,
  "can_view" | "can_create" | "can_update" | "can_delete"
>;

type PermissionGateProps = {
  user: AuthUser | null;
  moduleKey: string;
  required?: RequiredPermission;
  fallbackRoles?: string[];
  fallback?: ReactNode;
  children: ReactNode;
};

function canUseModule({
  user,
  moduleKey,
  required = "can_view",
  fallbackRoles = [],
}: Omit<PermissionGateProps, "children" | "fallback">) {
  const access = getStoredAccess();
  const permission = access?.permissions?.[moduleKey];

  if (permission) {
    return Boolean(permission[required]);
  }

  if (required !== "can_view") {
    return false;
  }

  return Boolean(user?.role && fallbackRoles.includes(user.role));
}

export function PermissionGate({
  user,
  moduleKey,
  required = "can_view",
  fallbackRoles = [],
  fallback = null,
  children,
}: PermissionGateProps) {
  const allowed = canUseModule({
    user,
    moduleKey,
    required,
    fallbackRoles,
  });

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
