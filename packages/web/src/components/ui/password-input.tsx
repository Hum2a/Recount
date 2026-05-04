"use client";

import { useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type PasswordInputWithToggleProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  inputClassName?: string;
};

/**
 * Password field with a Show / Hide control (does not submit the form).
 */
export function PasswordInputWithToggle({ id, className, inputClassName, ...props }: PasswordInputWithToggleProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={cn("relative mt-1", className)}>
      <input
        id={id}
        type={visible ? "text" : "password"}
        className={cn(
          "w-full rounded-md border border-white/10 bg-card py-2 pl-3 pr-[4.5rem] text-foreground",
          inputClassName
        )}
        {...props}
      />
      <button
        type="button"
        className="absolute right-1 top-1/2 h-8 min-w-[3.25rem] -translate-y-1/2 rounded-md px-2 text-xs font-medium text-muted transition-colors hover:bg-white/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
