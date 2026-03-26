import pkg from "../../../package.json";

export function SiteVersionFooter() {
  return (
    <footer className="mt-auto px-6 pb-5 pt-2">
      <p className="text-center text-[11px] leading-none text-muted/70 tabular-nums tracking-wide">
        v{pkg.version}
      </p>
    </footer>
  );
}
