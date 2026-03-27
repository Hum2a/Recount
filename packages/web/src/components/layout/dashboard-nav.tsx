"use client";

import Link from "next/link";
import { useId } from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useDashboardEntitlements } from "@/components/layout/dashboard-entitlements";

type Accent = "sky" | "emerald" | "violet" | "amber" | "blue" | "zinc" | "rose" | "fuchsia" | "teal";

const ACCENT: Record<
  Accent,
  { idle: string; active: string; pill: string }
> = {
  sky: {
    idle: "text-sky-300/90 hover:text-sky-200",
    active: "text-sky-50",
    pill: "bg-sky-500/20 ring-1 ring-sky-400/25",
  },
  emerald: {
    idle: "text-emerald-300/90 hover:text-emerald-200",
    active: "text-emerald-50",
    pill: "bg-emerald-500/20 ring-1 ring-emerald-400/25",
  },
  violet: {
    idle: "text-violet-300/90 hover:text-violet-200",
    active: "text-violet-50",
    pill: "bg-violet-500/20 ring-1 ring-violet-400/25",
  },
  amber: {
    idle: "text-amber-300/90 hover:text-amber-200",
    active: "text-amber-50",
    pill: "bg-amber-500/20 ring-1 ring-amber-400/25",
  },
  blue: {
    idle: "text-blue-300/90 hover:text-blue-200",
    active: "text-blue-50",
    pill: "bg-blue-500/20 ring-1 ring-blue-400/25",
  },
  zinc: {
    idle: "text-zinc-400 hover:text-zinc-200",
    active: "text-zinc-100",
    pill: "bg-zinc-500/25 ring-1 ring-zinc-400/20",
  },
  rose: {
    idle: "text-rose-300/90 hover:text-rose-200",
    active: "text-rose-50",
    pill: "bg-rose-500/20 ring-1 ring-rose-400/25",
  },
  fuchsia: {
    idle: "text-fuchsia-300/90 hover:text-fuchsia-200",
    active: "text-fuchsia-50",
    pill: "bg-fuchsia-500/20 ring-1 ring-fuchsia-400/25",
  },
  teal: {
    idle: "text-teal-300/90 hover:text-teal-200",
    active: "text-teal-50",
    pill: "bg-teal-500/20 ring-1 ring-teal-400/25",
  },
};

type NavItem = {
  href: string;
  label: string;
  hint: string;
  accent: Accent;
};

const baseLinks: NavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    hint: "Today's snapshot: time summaries, intentions, streaks, and license status.",
    accent: "sky",
  },
  {
    href: "/dashboard/activity",
    label: "Activity",
    hint: "A detailed view of your browser time—the same breakdowns support uses, scoped to your account.",
    accent: "emerald",
  },
  {
    href: "/dashboard/reports",
    label: "Reports",
    hint: "List and open AI-generated daily reports (license or staff access).",
    accent: "violet",
  },
  {
    href: "/dashboard/history",
    label: "History",
    hint: "Charts of your usage over recent days.",
    accent: "amber",
  },
  {
    href: "/dashboard/team",
    label: "Team",
    hint: "Team leaderboard and weekly minutes for your group.",
    accent: "blue",
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    hint: "Profile, demographics, and account preferences.",
    accent: "zinc",
  },
];

const adminLinks: NavItem[] = [
  {
    href: "/dashboard/admin",
    label: "Staff",
    hint: "Staff-only tools: user lookup and operational admin.",
    accent: "rose",
  },
  {
    href: "/dashboard/admin/analytics",
    label: "Audience",
    hint: "Signups and audience analytics for internal review.",
    accent: "fuchsia",
  },
];

const pricingLink: NavItem = {
  href: "/pricing",
  label: "Pricing",
  hint: "Compare plans, features, and billing options.",
  accent: "teal",
};

function NavTabLink({
  item,
  active,
  reduce,
}: {
  item: NavItem;
  active: boolean;
  reduce: boolean;
}) {
  const tooltipId = useId();
  const a = ACCENT[item.accent];

  return (
    <span className="group/tab relative inline-flex">
      <Link
        href={item.href}
        aria-describedby={tooltipId}
        className={cn(
          "relative rounded-md px-3 py-2 transition-[color,transform] duration-300 ease-smooth motion-safe:hover:scale-[1.02]",
          active ? a.active : a.idle
        )}
      >
        {active && !reduce && (
          <motion.span
            layoutId="dashboard-nav-pill"
            className={cn("absolute inset-0 -z-10 rounded-md", a.pill)}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}
        {active && reduce && (
          <span className={cn("absolute inset-0 -z-10 rounded-md", a.pill)} />
        )}
        <span className="relative z-10">{item.label}</span>
      </Link>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-[200] mt-2 max-h-[min(40vh,16rem)] w-max max-w-[min(18rem,calc(100vw-2rem))] origin-top -translate-x-1/2 overflow-y-auto rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-left text-xs font-normal leading-relaxed text-zinc-100 opacity-0 shadow-xl ring-1 ring-black/50 transition-[opacity,transform] duration-200 ease-out motion-safe:scale-[0.98] group-hover/tab:opacity-100 group-focus-within/tab:opacity-100 motion-safe:group-hover/tab:scale-100 motion-safe:group-focus-within/tab:scale-100"
      >
        {item.hint}
      </span>
    </span>
  );
}

export function DashboardNav() {
  const { isStaff, ready, staffNavFallback } = useDashboardEntitlements();
  const showAdminLink = ready ? isStaff : staffNavFallback;

  const links: NavItem[] = [
    ...baseLinks,
    ...(showAdminLink ? adminLinks : []),
    pricingLink,
  ];
  const pathname = usePathname();
  const reduceMotion = Boolean(useReducedMotion());

  return (
    <nav className="relative flex flex-wrap gap-1 border-b border-white/10 pb-4 text-sm">
      {links.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return <NavTabLink key={item.href} item={item} active={active} reduce={reduceMotion} />;
      })}
    </nav>
  );
}
