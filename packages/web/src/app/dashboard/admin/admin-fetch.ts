"use client";

import { createClient } from "@/lib/supabase/client";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function adminApi(path: string, init: RequestInit = {}) {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${apiUrl}${path}`, { ...init, headers, cache: "no-store" });
}
