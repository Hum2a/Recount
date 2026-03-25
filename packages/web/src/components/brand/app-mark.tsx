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
    <Link
      href={href}
      className={`group flex items-center gap-2.5 outline-none transition-opacity duration-200 hover:opacity-90 focus-visible:opacity-100 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG served from /public/icon.svg for reliable <img> loads */}
      <img
        src="/icon.svg"
        width={32}
        height={32}
        alt=""
        className="h-8 w-8 shrink-0 rounded-lg ring-0 transition-[transform,box-shadow,filter] duration-300 ease-smooth motion-safe:group-hover:scale-[1.04] motion-safe:group-hover:shadow-md motion-safe:group-hover:shadow-blue-500/20 motion-safe:group-focus-visible:ring-2 motion-safe:group-focus-visible:ring-accent/50"
      />
      <span
        className={`transition-[letter-spacing,color] duration-300 ease-smooth motion-safe:group-hover:tracking-wide ${wordmarkClassName}`}
      >
        Recount
      </span>
    </Link>
  );
}
