"use client";

import { createClient } from "@/lib/supabase/client";
import { getApiBaseUrl } from "@/lib/api-url";

export async function userApi(path: string, init: RequestInit = {}) {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${getApiBaseUrl()}${path}`, { ...init, headers, cache: "no-store" });
}
