"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const MAX_MS = 12000;

/**
 * Thin top bar while in-app navigations are in flight — gives immediate feedback on click
 * before RSC finishes (complements route `loading.tsx`).
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setActive(false);
    if (maxTimer.current) {
      clearTimeout(maxTimer.current);
      maxTimer.current = null;
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const el = (e.target as HTMLElement | null)?.closest("a[href]");
      if (!el || !(el instanceof HTMLAnchorElement)) return;
      if (el.target === "_blank" || el.hasAttribute("download")) return;
      const href = el.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      let nextUrl: URL;
      try {
        nextUrl = new URL(href, window.location.origin);
      } catch {
        return;
      }
      if (nextUrl.origin !== window.location.origin) return;

      const next = `${nextUrl.pathname}${nextUrl.search}`;
      const current = `${window.location.pathname}${window.location.search}`;
      if (next === current) return;

      setActive(true);
      if (maxTimer.current) clearTimeout(maxTimer.current);
      maxTimer.current = setTimeout(() => {
        setActive(false);
        maxTimer.current = null;
      }, MAX_MS);
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (maxTimer.current) clearTimeout(maxTimer.current);
    };
  }, [pathname]);

  if (!active) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-white/5"
      aria-hidden
    >
      <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-accent to-transparent opacity-90 motion-safe:animate-nav-progress" />
    </div>
  );
}
