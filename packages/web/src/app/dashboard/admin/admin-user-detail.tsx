"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatedCard } from "@/components/motion/animated-card";
import { adminApi } from "./admin-fetch";
import { AdminUserAccountTab, type AdminProfile } from "./admin-user-account-tab";
import { AdminUserIntentionsTab } from "./admin-user-intentions-tab";
import { AdminUserActivityTab } from "./admin-user-activity-tab";
import { AdminUserReportsTab } from "./admin-user-reports-tab";
import { AdminUserPaymentsTab } from "./admin-user-payments-tab";
import { cn } from "@/lib/utils";

type Counts = {
  intentions: number;
  tab_events: number;
  reports: number;
  payments: number;
};

type TabId = "account" | "intentions" | "activity" | "reports" | "payments";

type Props = {
  userId: string;
  canManage: boolean;
  currentUserId: string;
};

const tabs: { id: TabId; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "intentions", label: "Intentions" },
  { id: "activity", label: "Activity" },
  { id: "reports", label: "Reports" },
  { id: "payments", label: "Payments" },
];

export function AdminUserDetail({ userId, canManage, currentUserId }: Props) {
  const [tab, setTab] = useState<TabId>("account");
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reloadSummary = useCallback(async () => {
    const res = await adminApi(`/api/admin/users/${userId}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof body.error === "string" ? body.error : "Could not load this account.");
      setProfile(null);
      setCounts(null);
      return;
    }
    const data = body.data as { profile?: AdminProfile; counts?: Counts } | undefined;
    if (data?.profile) {
      setProfile(data.profile);
      setCounts(
        data.counts ?? { intentions: 0, tab_events: 0, reports: 0, payments: 0 }
      );
      setError(null);
    }
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await reloadSummary();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadSummary]);

  function countFor(t: TabId): number | null {
    if (!counts) return null;
    switch (t) {
      case "intentions":
        return counts.intentions;
      case "activity":
        return counts.tab_events;
      case "reports":
        return counts.reports;
      case "payments":
        return counts.payments;
      default:
        return null;
    }
  }

  const isYou = profile && profile.id === currentUserId;

  return (
    <div className="space-y-6">
      {loading && <p className="text-sm text-muted">Loading account…</p>}
      {error && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>
      )}

      {profile && !error && (
        <>
          <AnimatedCard className="rounded-xl bg-card/80 p-5 shadow-lg shadow-black/15 ring-1 ring-white/10 backdrop-blur-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <div>
                <h1 className="text-xl font-semibold text-foreground">{profile.email}</h1>
                {isYou && (
                  <span className="mt-1 inline-block rounded bg-white/10 px-2 py-0.5 text-xs text-muted">You</span>
                )}
              </div>
              <p className="text-sm text-muted">
                {counts && (
                  <>
                    {counts.intentions} intentions · {counts.tab_events} activity rows · {counts.reports} reports ·{" "}
                    {counts.payments} payments
                  </>
                )}
              </p>
            </div>
          </AnimatedCard>

          <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
            {tabs.map((t) => {
              const n = countFor(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm transition-colors",
                    tab === t.id
                      ? "bg-white/[0.1] text-foreground ring-1 ring-white/15"
                      : "text-muted hover:bg-white/[0.05] hover:text-foreground"
                  )}
                >
                  {t.label}
                  {n != null && t.id !== "account" && (
                    <span className="ml-1.5 text-xs opacity-80">({n})</span>
                  )}
                </button>
              );
            })}
          </div>

          <AnimatedCard
            delay={0.04}
            className="rounded-xl bg-card/80 p-6 shadow-lg shadow-black/15 ring-1 ring-white/10 backdrop-blur-sm"
          >
            {tab === "account" && (
              <AdminUserAccountTab
                userId={userId}
                profile={profile}
                canManage={canManage}
                onProfileSaved={(p) => setProfile(p)}
              />
            )}
            {tab === "intentions" && (
              <AdminUserIntentionsTab userId={userId} canManage={canManage} onDataChanged={reloadSummary} />
            )}
            {tab === "activity" && (
              <AdminUserActivityTab userId={userId} canManage={canManage} onDataChanged={reloadSummary} />
            )}
            {tab === "reports" && (
              <AdminUserReportsTab userId={userId} canManage={canManage} onDataChanged={reloadSummary} />
            )}
            {tab === "payments" && <AdminUserPaymentsTab userId={userId} />}
          </AnimatedCard>
        </>
      )}
    </div>
  );
}
