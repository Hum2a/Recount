import Link from "next/link";

type AppMarkProps = {
  href: string;
  className?: string;
  wordmarkClassName?: string;
};

export function AppMark({
  href,
  className = "",
  wordmarkClassName = "text-lg font-semibold tracking-tight",
}: AppMarkProps) {
  return (
    <Link href={href} className={`flex items-center gap-2.5 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG app icon from /icon.svg metadata route */}
      <img src="/icon.svg" width={32} height={32} alt="" className="h-8 w-8 shrink-0 rounded-lg" />
      <span className={wordmarkClassName}>Recount</span>
    </Link>
  );
}
