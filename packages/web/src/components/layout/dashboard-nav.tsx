"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const baseLinks = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/activity", label: "Activity" },
  { href: "/dashboard/reports", label: "Reports" },
  { href: "/dashboard/history", label: "History" },
  { href: "/dashboard/team", label: "Team" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function DashboardNav({ showAdminLink = false }: { showAdminLink?: boolean }) {
  const links = [
    ...baseLinks,
    ...(showAdminLink
      ? ([
          { href: "/dashboard/admin" as const, label: "Staff" },
          { href: "/dashboard/admin/analytics" as const, label: "Audience" },
        ] as const)
      : []),
    { href: "/pricing" as const, label: "Pricing" },
  ];
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <nav className="relative flex flex-wrap gap-1 border-b border-white/10 pb-4 text-sm">
      {links.map((l) => {
        const active =
          l.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "relative rounded-md px-3 py-2 transition-[color,transform] duration-300 ease-smooth motion-safe:hover:scale-[1.02]",
              active ? "text-foreground" : "text-muted hover:text-foreground"
            )}
          >
            {active && !reduce && (
              <motion.span
                layoutId="dashboard-nav-pill"
                className="absolute inset-0 -z-10 rounded-md bg-white/[0.08] ring-1 ring-white/10"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            {active && reduce && (
              <span className="absolute inset-0 -z-10 rounded-md bg-white/[0.08] ring-1 ring-white/10" />
            )}
            <span className="relative z-10">{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
