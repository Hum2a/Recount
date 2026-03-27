import Link from "next/link";
import pkg from "../../../package.json";

export function SiteVersionFooter() {
  return (
    <footer className="mt-auto px-6 pb-5 pt-2">
      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-[11px] leading-none text-muted/70 tabular-nums tracking-wide">
        <Link href="/privacy" className="text-muted/80 underline-offset-4 hover:text-muted hover:underline">
          Privacy
        </Link>
        <span className="text-muted/40" aria-hidden>
          ·
        </span>
        <span>v{pkg.version}</span>
      </p>
    </footer>
  );
}
