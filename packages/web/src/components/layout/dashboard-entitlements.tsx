"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getApiBaseUrl } from "@/lib/api-url";
import { hasFullProductAccess, isStaffAppRole, planLabelForDisplay } from "@/lib/entitlements";

export type DashboardEntitlementsValue = {
  licenseActive: boolean;
  appRole: string;
  loading: boolean;
  error: string | null;
  /** True once a successful `/api/payments/status` response was applied. */
  ready: boolean;
  refresh: () => Promise<void>;
  /** Until `ready`, prefer SSR hint for Staff nav to avoid link flicker. */
  staffNavFallback: boolean;
  fullAccess: boolean;
  planLabel: string;
  isStaff: boolean;
};

const DashboardEntitlementsContext = createContext<DashboardEntitlementsValue | null>(null);

export function DashboardEntitlementsProvider({
  children,
  staffNavFallback,
}: {
  children: React.ReactNode;
  /** From server: Supabase `profiles.app_role` (nav SSR hint). */
  staffNavFallback: boolean;
}) {
  const [licenseActive, setLicenseActive] = useState(false);
  const [appRole, setAppRole] = useState("user");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setLoading(false);
      setReady(false);
      setError("Not signed in");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/payments/status`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as { data?: { license_active?: boolean; app_role?: string }; error?: string };
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : `HTTP ${res.status}`);
        setReady(false);
        return;
      }
      if (!body.data) {
        setError("Could not load account status.");
        setReady(false);
        return;
      }
      setLicenseActive(Boolean(body.data.license_active));
      setAppRole(typeof body.data.app_role === "string" ? body.data.app_role : "user");
      setError(null);
      setReady(true);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Could not reach the Recount API.";
      setError(
        raw === "Failed to fetch"
          ? "Failed to fetch (API unreachable or CORS). Start the API with npm run dev:api; ALLOWED_ORIGINS must include your browser origin (e.g. http://127.0.0.1:3000 if you open the app that way)."
          : raw
      );
      setReady(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void load();
    });
    return () => subscription.unsubscribe();
  }, [load]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") void load();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  useEffect(() => {
    function onExternalRefresh() {
      void load();
    }
    window.addEventListener("recount:entitlements-refresh", onExternalRefresh);
    return () => window.removeEventListener("recount:entitlements-refresh", onExternalRefresh);
  }, [load]);

  const value = useMemo<DashboardEntitlementsValue>(
    () => ({
      licenseActive,
      appRole,
      loading,
      error,
      ready,
      refresh: load,
      staffNavFallback,
      fullAccess: hasFullProductAccess(licenseActive, appRole),
      planLabel: planLabelForDisplay(licenseActive, appRole),
      isStaff: isStaffAppRole(appRole),
    }),
    [licenseActive, appRole, loading, error, ready, load, staffNavFallback]
  );

  return <DashboardEntitlementsContext.Provider value={value}>{children}</DashboardEntitlementsContext.Provider>;
}

export function useDashboardEntitlements(): DashboardEntitlementsValue {
  const ctx = useContext(DashboardEntitlementsContext);
  if (!ctx) {
    throw new Error("useDashboardEntitlements must be used under DashboardEntitlementsProvider");
  }
  return ctx;
}
