"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

type HintTriggerProps = {
  /** Full explanation shown in the tooltip */
  hint: string;
  /** Short name for screen readers, e.g. "Hourly rate" */
  labelForA11y: string;
  className?: string;
};

/**
 * Small “?” control: hover or keyboard focus shows the hint. Uses aria-describedby for assistive tech.
 */
export function HintTrigger({ hint, labelForA11y, className }: HintTriggerProps) {
  const tooltipId = useId();
  return (
    <span className={cn("group/hint relative inline-flex shrink-0 align-middle", className)}>
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-[10px] font-semibold leading-none text-muted transition-colors hover:border-white/25 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
        aria-describedby={tooltipId}
        aria-label={`Help: ${labelForA11y}`}
      >
        ?
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-[200] mt-2 max-h-[min(40vh,16rem)] w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 overflow-y-auto rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-left text-xs font-normal leading-relaxed text-zinc-100 shadow-xl opacity-0 ring-1 ring-black/50 transition-opacity duration-150 group-hover/hint:opacity-100 group-focus-within/hint:opacity-100 sm:left-0 sm:translate-x-0"
      >
        {hint}
      </span>
    </span>
  );
}

type FieldWithHintProps = {
  id: string;
  label: string;
  hint: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Label row + hint; pass an input/textarea/select with matching `id` as children.
 */
export function FieldWithHint({ id, label, hint, className, children }: FieldWithHintProps) {
  return (
    <div className={cn("block text-sm text-muted", className)}>
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <label htmlFor={id}>{label}</label>
        <HintTrigger hint={hint} labelForA11y={label} />
      </div>
      {children}
    </div>
  );
}

type CheckboxWithHintProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
  hint: string;
  className?: string;
};

export function CheckboxWithHint({ checked, onChange, disabled, label, hint, className }: CheckboxWithHintProps) {
  const inputId = useId();
  return (
    <label
      className={cn("flex cursor-pointer items-start gap-3 text-sm text-muted", disabled && "cursor-not-allowed opacity-60", className)}
    >
      <input
        id={inputId}
        type="checkbox"
        className="mt-1"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="flex flex-1 flex-wrap items-center gap-1.5 pt-0.5">
        <span>{label}</span>
        <HintTrigger hint={hint} labelForA11y={label} />
      </span>
    </label>
  );
}
