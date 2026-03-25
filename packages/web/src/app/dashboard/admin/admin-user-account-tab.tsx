"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckboxWithHint, FieldWithHint } from "@/components/ui/field-hint";
import { adminApi } from "./admin-fetch";

const ROLES = ["user", "admin", "developer"] as const;
type AppRole = (typeof ROLES)[number];

export type AdminProfile = {
  id: string;
  email: string;
  stripe_customer_id: string | null;
  license_active: boolean;
  license_key: string | null;
  hourly_rate: number | string | null;
  timezone: string;
  app_role: string;
  created_at: string;
  updated_at: string;
};

type Props = {
  userId: string;
  profile: AdminProfile;
  canManage: boolean;
  onProfileSaved: (p: AdminProfile) => void;
};

const inputClass =
  "mt-1 w-full rounded-md border border-white/10 bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted/70";

export function AdminUserAccountTab({ userId, profile, canManage, onProfileSaved }: Props) {
  const [email, setEmail] = useState(profile.email);
  const [hourlyRate, setHourlyRate] = useState(String(profile.hourly_rate ?? 0));
  const [timezone, setTimezone] = useState(profile.timezone);
  const [licenseActive, setLicenseActive] = useState(profile.license_active);
  const [stripeCustomerId, setStripeCustomerId] = useState(profile.stripe_customer_id ?? "");
  const [licenseKey, setLicenseKey] = useState(profile.license_key ?? "");
  const [appRole, setAppRole] = useState<AppRole>(
    ROLES.includes(profile.app_role as AppRole) ? (profile.app_role as AppRole) : "user"
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setEmail(profile.email);
    setHourlyRate(String(profile.hourly_rate ?? 0));
    setTimezone(profile.timezone);
    setLicenseActive(profile.license_active);
    setStripeCustomerId(profile.stripe_customer_id ?? "");
    setLicenseKey(profile.license_key ?? "");
    setAppRole(ROLES.includes(profile.app_role as AppRole) ? (profile.app_role as AppRole) : "user");
  }, [profile]);

  async function save() {
    if (!canManage) return;
    setBusy(true);
    setMsg(null);
    const rateNum = Number.parseFloat(hourlyRate);
    if (Number.isNaN(rateNum) || rateNum < 0) {
      setMsg("Hourly rate must be a valid number.");
      setBusy(false);
      return;
    }
    const body: Record<string, unknown> = {
      hourly_rate: rateNum,
      timezone: timezone.trim(),
      license_active: licenseActive,
      app_role: appRole,
    };
    if (email.trim() !== profile.email) body.email = email.trim();
    const stripeTrim = stripeCustomerId.trim();
    if (stripeTrim !== (profile.stripe_customer_id ?? "")) {
      body.stripe_customer_id = stripeTrim === "" ? null : stripeTrim;
    }
    const keyTrim = licenseKey.trim();
    if (keyTrim !== (profile.license_key ?? "")) {
      body.license_key = keyTrim === "" ? null : keyTrim;
    }

    try {
      const res = await adminApi(`/api/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok) {
        setMsg(typeof data.error === "string" ? data.error : "Could not save account.");
        return;
      }
      const next = data.data as AdminProfile;
      if (next) {
        onProfileSaved(next);
        setMsg("Account saved.");
      }
    } catch {
      setBusy(false);
      setMsg("Could not save account.");
    }
  }

  return (
    <div className="space-y-6">
      {!canManage && (
        <p className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-muted">
          View only. Staff with full manage access can edit these fields.
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <FieldWithHint
          id={`admin-account-email-${userId}`}
          label="Email"
          hint="Sign-in address (also stored on auth.users). Changing it updates Supabase Auth and the profile row—use for corrections or support."
          className="sm:col-span-2"
        >
          <input
            id={`admin-account-email-${userId}`}
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!canManage}
          />
        </FieldWithHint>
        <FieldWithHint
          id={`admin-account-hourly-${userId}`}
          label="Hourly rate"
          hint="User’s self-reported £/hour in the product (same meaning as Settings). Not billing; optional context for reports or exports."
        >
          <input
            id={`admin-account-hourly-${userId}`}
            type="number"
            step="0.01"
            min={0}
            className={inputClass}
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            disabled={!canManage}
          />
        </FieldWithHint>
        <FieldWithHint
          id={`admin-account-tz-${userId}`}
          label="Timezone"
          hint="IANA timezone on the profile (e.g. Europe/London). Affects how they think about “today” in the app; API still stores events in UTC."
        >
          <input
            id={`admin-account-tz-${userId}`}
            className={inputClass}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            disabled={!canManage}
          />
        </FieldWithHint>
        <CheckboxWithHint
          className="sm:col-span-2"
          checked={licenseActive}
          onChange={setLicenseActive}
          disabled={!canManage}
          label="Pro / paid access (normally updated by billing — only change for support)"
          hint="When on, the user is treated as licensed (Pro): longer history, AI reports, etc. Stripe webhooks usually set this; toggle manually for refunds, comps, or fixing bad data."
        />
        <FieldWithHint
          id={`admin-account-stripe-${userId}`}
          label="Stripe customer ID"
          hint="Stripe’s cus_… id linking this user to subscriptions/invoices. Clear the field to remove the link; only set if you know the correct id from Stripe."
          className="sm:col-span-2"
        >
          <input
            id={`admin-account-stripe-${userId}`}
            className={`${inputClass} font-mono text-xs`}
            value={stripeCustomerId}
            onChange={(e) => setStripeCustomerId(e.target.value)}
            disabled={!canManage}
            placeholder="Leave empty to clear"
          />
        </FieldWithHint>
        <FieldWithHint
          id={`admin-account-license-key-${userId}`}
          label="License key"
          hint="Optional legacy or manual license string shown to the user after purchase. Empty clears it. Do not invent keys unless your product flow uses them."
          className="sm:col-span-2"
        >
          <input
            id={`admin-account-license-key-${userId}`}
            className={`${inputClass} font-mono text-xs`}
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            disabled={!canManage}
            placeholder="Leave empty to clear"
          />
        </FieldWithHint>
        <FieldWithHint
          id={`admin-account-role-${userId}`}
          label="Staff access"
          hint="Member = normal user. Administrator = can change roles and full staff tools. Developer = can use staff views; only admins can change roles. Misuse can expose all accounts—assign carefully."
          className="sm:col-span-2"
        >
          <select
            id={`admin-account-role-${userId}`}
            className={inputClass}
            value={appRole}
            onChange={(e) => setAppRole(e.target.value as AppRole)}
            disabled={!canManage}
          >
            <option value="user">Member</option>
            <option value="admin">Administrator</option>
            <option value="developer">Developer (staff)</option>
          </select>
        </FieldWithHint>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-xs text-muted">
        <p>
          <span className="font-medium text-foreground">User id</span>{" "}
          <code className="text-foreground/90">{profile.id}</code>
        </p>
        <p className="mt-1">
          Created {new Date(profile.created_at).toLocaleString()} · Updated{" "}
          {new Date(profile.updated_at).toLocaleString()}
        </p>
      </div>

      {msg && <p className="text-sm text-muted">{msg}</p>}
      {canManage && (
        <Button type="button" disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save account"}
        </Button>
      )}
    </div>
  );
}
