import type { User } from "@supabase/supabase-js";

export type ProfileAuthContext = {
  id: string;
  app_role: string;
  license_active: boolean;
};

export type AppVars = {
  user: User;
  accessToken: string;
  profile: ProfileAuthContext;
};
