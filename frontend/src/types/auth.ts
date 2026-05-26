export type UserProfile = {
  id: number;
  role: string;
  role_display: string;
  is_active_profile: boolean;
  phone: string;
  position: string;
  area: string;
  created_at: string;
  updated_at: string;
};

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  is_active: boolean;
  profile: UserProfile;
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};

export type LoginCredentials = {
  username: string;
  password: string;
};