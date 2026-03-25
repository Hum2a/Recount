"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { PRICING_FEATURES, type PricingFeatureDetail } from "./pricing-features-data";

export function PricingFeatureTable() {
  const [open, setOpen] = useState<PricingFeatureDetail | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>("[data-pricing-modal-close]")?.focus();
      });
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <p className="text-sm text-muted">
        <span className="font-medium text-foreground/90">Tip:</span> Click a row (or focus it and press Enter) to open a
        full explanation of how that feature works and what you can do with it.
      </p>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <caption className="sr-only">
            Feature comparison: Free versus Lifetime. Each row opens a detailed description.
          </caption>
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.04]">
              <th scope="col" className="px-4 py-3 font-medium text-foreground">
                Feature
              </th>
              <th scope="col" className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                Free
              </th>
              <th scope="col" className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                Lifetime
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06] text-muted">
            {PRICING_FEATURES.map((f) => (
              <tr
                key={f.id}
                tabIndex={0}
                className="cursor-pointer border-b border-white/[0.06] transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/25"
                onClick={() => setOpen(f)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpen(f);
                  }
                }}
                aria-label={`Learn more: ${f.name}`}
              >
                <th scope="row" className="px-4 py-3.5 text-left font-normal text-foreground/95">
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {f.name}
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted">Details</span>
                  </span>
                </th>
                <td className="px-4 py-3.5 align-top">{f.free}</td>
                <td className="px-4 py-3.5 align-top">{f.premium}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open &&
        typeof document !== "undefined" &&
        createPortal(<FeatureDetailModal feature={open} onClose={() => setOpen(null)} />, document.body)}
    </>
  );
}

function FeatureDetailModal({ feature, onClose }: { feature: PricingFeatureDetail; onClose: () => void }) {
  const titleId = useId();
  const paragraphs = feature.body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
        aria-label="Close feature details"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[1] flex max-h-[min(85vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-white/10 px-5 py-4">
          <h3 id={titleId} className="pr-10 text-base font-semibold leading-snug text-foreground">
            {feature.name}
          </h3>
          <p className="mt-2 text-sm text-muted">{feature.tagline}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2">
              <p className="font-medium text-foreground/90">Free</p>
              <p className="mt-1 text-muted">{feature.free}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2">
              <p className="font-medium text-foreground/90">Lifetime</p>
              <p className="mt-1 text-muted">{feature.premium}</p>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-4 text-sm leading-relaxed text-muted">
            {paragraphs.map((p, i) => (
              <p key={i}>{formatBodyParagraph(p)}</p>
            ))}
          </div>
        </div>
        <div className="border-t border-white/10 px-5 py-3">
          <Button
            data-pricing-modal-close
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Bold **segments** in copy (simple markdown-lite). */
function formatBodyParagraph(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-medium text-foreground/95">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
