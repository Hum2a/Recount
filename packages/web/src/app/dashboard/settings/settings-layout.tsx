"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const SETTINGS_SECTIONS = [
  { id: "settings-overview", label: "Overview" },
  { id: "settings-general", label: "General" },
  { id: "settings-features", label: "Features" },
  { id: "settings-about", label: "About you" },
  { id: "settings-save", label: "Save" },
  { id: "settings-export", label: "Export" },
] as const;

/** In-page anchors inside the Features block (jump menu). */
export const FEATURE_SUBSECTIONS = [
  { id: "features-extension", label: "Extension" },
  { id: "features-distractions", label: "Distractions" },
  { id: "features-email", label: "Email" },
  { id: "features-team", label: "Team" },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];

/** Default expanded state for collapsible sections (nav ids that use CollapsibleSettingsBlock). */
const DEFAULT_OPEN: Record<string, boolean> = {
  "settings-general": true,
  "settings-features": true,
  "settings-about": false,
  "settings-export": true,
};

function initialSectionOpenMap(): Record<string, boolean> {
  const m = { ...DEFAULT_OPEN };
  for (const s of SETTINGS_SECTIONS) {
    if (s.id === "settings-overview" || s.id === "settings-save") continue;
    if (m[s.id] === undefined) m[s.id] = true;
  }
  return m;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={cn("h-5 w-5 shrink-0 text-muted transition-transform duration-200", !open && "-rotate-90")}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.08 0L5.21 8.29a.75.75 0 01.02-1.08z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function CollapsibleSettingsBlock({
  id,
  title,
  description,
  children,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
}: {
  id: SettingsSectionId | string;
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** Controlled mode (optional) — e.g. open section when jumping from nav. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolled;
  const setOpen = (next: boolean) => {
    if (isControlled) onOpenChange?.(next);
    else setUncontrolled(next);
  };

  return (
    <section
      id={id}
      className="scroll-mt-28 overflow-hidden rounded-xl border border-white/10 bg-card/40 ring-1 ring-white/[0.04]"
    >
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.04] sm:px-5"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
      >
        <span>
          <span className="block text-base font-medium text-foreground">{title}</span>
          {description ? <span className="mt-0.5 block text-sm text-muted">{description}</span> : null}
        </span>
        <Chevron open={open} />
      </button>
      <div
        id={`${id}-panel`}
        className={cn("border-t border-white/10 px-4 pb-5 pt-1 sm:px-5", !open && "hidden")}
      >
        <div className="space-y-4 pt-3">{children}</div>
      </div>
    </section>
  );
}

export function SettingsSectionNav({
  activeId,
  onNavigate,
}: {
  activeId: string;
  onNavigate: (id: string) => void;
}) {
  return (
    <nav
      className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0 lg:pr-1"
      aria-label="Settings sections"
    >
      {SETTINGS_SECTIONS.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onNavigate(s.id)}
          className={cn(
            "whitespace-nowrap rounded-md px-2.5 py-1.5 text-left text-sm transition-colors lg:w-full",
            activeId === s.id
              ? "bg-white/[0.1] font-medium text-foreground ring-1 ring-white/15"
              : "text-muted hover:bg-white/[0.05] hover:text-foreground"
          )}
        >
          {s.label}
        </button>
      ))}
    </nav>
  );
}

export function FeatureSubsectionNav({ onNavigate }: { onNavigate: (featureAnchorId: string) => void }) {
  return (
    <nav
      className="flex flex-wrap gap-1 border-b border-white/10 pb-3 lg:flex-col lg:border-b-0 lg:pb-0"
      aria-label="Feature settings subsections"
    >
      {FEATURE_SUBSECTIONS.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onNavigate(s.id)}
          className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-left text-xs text-muted transition-colors hover:bg-white/[0.06] hover:text-foreground lg:w-full lg:text-sm"
        >
          {s.label}
        </button>
      ))}
    </nav>
  );
}

export function useSettingsScrollSpy(sectionIds: readonly string[]) {
  const [activeId, setActiveId] = useState(sectionIds[0] ?? "settings-overview");

  useEffect(() => {
    const onScroll = () => {
      const offset = 140;
      const y = window.scrollY + offset;
      let current = sectionIds[0];
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= y) current = id;
      }
      if (current) setActiveId(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [sectionIds]);

  return activeId;
}

export function useSettingsSectionOpenState() {
  return useState<Record<string, boolean>>(initialSectionOpenMap);
}
