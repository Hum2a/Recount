import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

/** Anon client for password auth flows proxied from clients */
export const supabaseAuth = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
