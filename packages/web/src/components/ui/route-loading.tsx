import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Shown below the spinner for screen readers */
  label?: string;
};

/**
 * Full-area loading state for App Router `loading.tsx` segments.
 */
export function RouteLoading({ className, label = "Loading page" }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      className={cn(
        "flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 py-16",
        className
      )}
    >
      <div
        className={cn(
          "h-10 w-10 rounded-full border-2 border-white/15 border-t-accent",
          "motion-safe:animate-spin"
        )}
        aria-hidden
      />
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
