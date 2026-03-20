"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AuthChangeEvent } from "@supabase/supabase-js";

/**
 * Keeps RSC in sync when auth meaningfully changes (login/logout/profile).
 *
 * We intentionally do NOT call router.refresh() on TOKEN_REFRESHED or INITIAL_SESSION:
 * - TOKEN_REFRESHED fires often; middleware already rotates cookies on the next request.
 *   Refreshing the whole tree each time makes every navigation feel slow.
 * - INITIAL_SESSION would double-fetch right after the first paint.
 */
function shouldRefreshRsc(event: AuthChangeEvent): boolean {
  return (
    event === "SIGNED_IN" ||
    event === "SIGNED_OUT" ||
    event === "USER_UPDATED" ||
    event === "PASSWORD_RECOVERY"
  );
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();

    void supabase.auth.getSession();

    function scheduleRefresh() {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = undefined;
        router.refresh();
      }, 80);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!shouldRefreshRsc(event)) {
        return;
      }
      if (session) {
        void supabase.auth.getSession();
      }
      scheduleRefresh();
    });

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      subscription.unsubscribe();
    };
  }, [router]);

  return <>{children}</>;
}
