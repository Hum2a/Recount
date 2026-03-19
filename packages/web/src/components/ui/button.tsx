import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50",
        variant === "primary" && "bg-accent text-white hover:opacity-90",
        variant === "secondary" && "bg-card text-foreground ring-1 ring-white/10 hover:bg-white/5",
        variant === "ghost" && "text-muted hover:text-foreground",
        className
      )}
      {...props}
    />
  );
}
