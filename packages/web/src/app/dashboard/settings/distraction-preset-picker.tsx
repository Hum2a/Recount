"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { DISTRACTION_PRESET_GROUPS } from "./distraction-presets";

type Props = {
  disabled?: boolean;
  /** Selected preset hostnames (lowercase). */
  value: string[];
  onChange: (hosts: string[]) => void;
  className?: string;
};

function sortHosts(hosts: string[]): string[] {
  return [...new Set(hosts.map((h) => h.trim().toLowerCase()).filter(Boolean))].sort();
}

export function DistractionPresetPicker({ disabled, value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selectedSet = useMemo(() => new Set(value.map((h) => h.toLowerCase())), [value]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DISTRACTION_PRESET_GROUPS;
    return DISTRACTION_PRESET_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter(
        (it) => it.host.includes(q) || it.label.toLowerCase().includes(q) || g.label.toLowerCase().includes(q)
      ),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  const totalPresets = useMemo(
    () => DISTRACTION_PRESET_GROUPS.reduce((n, g) => n + g.items.length, 0),
    []
  );

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const el = containerRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function toggle(host: string) {
    const h = host.toLowerCase();
    const next = new Set(selectedSet);
    if (next.has(h)) next.delete(h);
    else next.add(h);
    onChange(sortHosts([...next]));
  }

  function selectGroup(groupId: string) {
    const g = DISTRACTION_PRESET_GROUPS.find((x) => x.id === groupId);
    if (!g) return;
    const next = new Set(selectedSet);
    for (const { host } of g.items) next.add(host.toLowerCase());
    onChange(sortHosts([...next]));
  }

  function clearGroup(groupId: string) {
    const g = DISTRACTION_PRESET_GROUPS.find((x) => x.id === groupId);
    if (!g) return;
    const remove = new Set(g.items.map((i) => i.host.toLowerCase()));
    onChange(sortHosts(value.filter((h) => !remove.has(h.toLowerCase()))));
  }

  const summary =
    value.length === 0
      ? `Choose from ${totalPresets} common sites…`
      : `${value.length} preset site${value.length === 1 ? "" : "s"} selected`;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border border-white/10 bg-card px-3 py-2.5 text-left text-sm text-foreground shadow-sm transition-[border-color,box-shadow] duration-200",
          "hover:border-white/15 focus-visible:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
          disabled && "pointer-events-none opacity-50"
        )}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        <span className={cn("truncate", value.length === 0 && "text-muted")}>{summary}</span>
        <svg
          className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")}
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
      </button>

      {open && !disabled ? (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-[100] mt-1 max-h-[min(24rem,70vh)] w-full overflow-hidden rounded-md border border-white/10 bg-zinc-950 shadow-xl ring-1 ring-black/40"
        >
          <div className="border-b border-white/10 p-2">
            <input
              type="search"
              className="w-full rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted focus-visible:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
              placeholder="Search sites or categories…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-[min(18rem,55vh)] overflow-y-auto overscroll-contain p-2">
            {filteredGroups.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-muted">No matches.</p>
            ) : (
              filteredGroups.map((group) => {
                return (
                  <div key={group.id} className="mb-3 last:mb-0">
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 px-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{group.label}</span>
                      <span className="flex gap-1">
                        <button
                          type="button"
                          className="rounded px-1.5 py-0.5 text-[11px] text-accent hover:bg-white/10"
                          onClick={() => selectGroup(group.id)}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          className="rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-white/10 hover:text-foreground"
                          onClick={() => clearGroup(group.id)}
                        >
                          None
                        </button>
                      </span>
                    </div>
                    <ul className="space-y-0.5">
                      {group.items.map((item) => {
                        const checked = selectedSet.has(item.host.toLowerCase());
                        return (
                          <li key={item.host}>
                            <label
                              className={cn(
                                "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-white/[0.06]",
                                checked && "bg-white/[0.08]"
                              )}
                            >
                              <input
                                type="checkbox"
                                className="rounded border-white/20"
                                checked={checked}
                                onChange={() => toggle(item.host)}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="font-medium text-foreground">{item.label}</span>
                                <span className="ml-2 font-mono text-xs text-muted">{item.host}</span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
