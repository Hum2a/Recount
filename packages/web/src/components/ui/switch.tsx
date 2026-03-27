"use client";

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "role" | "type" | "onClick"> & {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  /** Optional id for label association */
  id?: string;
};

export function Switch({ checked, onCheckedChange, id, className, disabled, ...rest }: Props) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border border-white/10 transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-45",
        checked ? "bg-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]" : "bg-white/[0.12]",
        className
      )}
      onClick={() => onCheckedChange(!checked)}
      {...rest}
    >
      <span
        className={cn(
          "pointer-events-none absolute top-0.5 left-0.5 block h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 ease-out",
          checked && "translate-x-5"
        )}
        aria-hidden
      />
    </button>
  );
}
