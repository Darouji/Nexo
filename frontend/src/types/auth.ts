export type UserRole =
  | "ADMINISTRADOR"
  | "RRHH"
  | "INFORMATICO"
  | "FINANZAS_COMERCIAL"
  | "OPERATIVO"
  | "CONSULTA"
  | string;

export type AuthUser = {
  id: number;
  username: string;
  email: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  role: UserRole;
  role_display: string;
  status: string;
  status_display?: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  phone: string;
  position: string;
  department: string;
  observations?: string;
  last_login?: string | null;
  date_joined?: string;
  created_at?: string;
  updated_at?: string;
};

export type ModulePermission = {
  can_view: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
};

export type AccessMenuItem = {
  key: string;
  label: string;
  path: string;
  module: string;
};

export type AccessPayload = {
  role: UserRole;
  is_management_role: boolean;
  is_read_role: boolean;
  is_audit_role: boolean;
  permissions: Record<string, ModulePermission>;
  menu: AccessMenuItem[];
};

export type AuthSessionStatus = {
  authenticated: boolean;
  token_created_at: string | null;
  token_expires_at: string | null;
  token_expires_in_seconds: number | null;
  token_expire_hours: number | null;
};

export type AuthSessionResponse = {
  user: AuthUser;
  access: AccessPayload;
  session: AuthSessionStatus;
};

export type LoginResponse = {
  token: string;
  token_type?: string;
  token_created_at?: string;
  token_expires_at?: string | null;
  token_expires_in_seconds?: number | null;
  token_expire_hours?: number | null;
  user: AuthUser;
  access?: AccessPayload;
};

export type LoginCredentials = {
  username: string;
  password: string;
};
