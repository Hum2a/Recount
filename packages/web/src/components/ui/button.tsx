import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium",
        "transition-[transform,box-shadow,background-color,color,opacity,filter] duration-300 ease-smooth",
        "hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        variant === "primary" &&
          "bg-accent text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35 hover:scale-[1.02]",
        variant === "secondary" &&
          "bg-card text-foreground ring-1 ring-white/10 hover:bg-white/[0.07] hover:ring-white/15 hover:scale-[1.01]",
        variant === "ghost" && "text-muted hover:bg-white/5 hover:text-foreground hover:scale-[1.01]",
        className
      )}
      {...props}
    />
  );
}
