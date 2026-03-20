import Link from "next/link";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/reports", label: "Reports" },
  { href: "/dashboard/history", label: "History" },
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/pricing", label: "Pricing" },
];

export function DashboardNav() {
  return (
    <nav className="flex flex-wrap gap-4 border-b border-white/10 pb-4 text-sm text-muted">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="hover:text-foreground">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
