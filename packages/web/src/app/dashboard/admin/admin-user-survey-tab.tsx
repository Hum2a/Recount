"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldWithHint } from "@/components/ui/field-hint";
import { adminApi } from "./admin-fetch";
import type { AdminProfile } from "./admin-user-account-tab";

const COMPANY_SIZES = [
  { value: "", label: "Skip — no answer" },
  { value: "1", label: "Just me" },
  { value: "2-10", label: "2–10" },
  { value: "11-50", label: "11–50" },
  { value: "51-200", label: "51–200" },
  { value: "201+", label: "201+" },
  { value: "prefer_not_say", label: "Prefer not to say" },
] as const;

type Props = {
  userId: string;
  profile: AdminProfile;
  canManage: boolean;
  onProfileSaved: (p: AdminProfile) => void;
};

const inputClass =
  "mt-1 w-full rounded-md border border-white/10 bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted/70";

export function AdminUserSurveyTab({ userId, profile, canManage, onProfileSaved }: Props) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [birthYear, setBirthYear] = useState(
    profile.birth_year != null ? String(profile.birth_year) : ""
  );
  const [countryCode, setCountryCode] = useState(profile.country_code ?? "");
  const [locale, setLocale] = useState(profile.locale ?? "");
  const [genderIdentity, setGenderIdentity] = useState(profile.gender_identity ?? "");
  const [occupation, setOccupation] = useState(profile.occupation ?? "");
  const [industry, setIndustry] = useState(profile.industry ?? "");
  const [workRole, setWorkRole] = useState(profile.work_role ?? "");
  const [companySize, setCompanySize] = useState(profile.company_size ?? "");
  const [primaryUseCase, setPrimaryUseCase] = useState(profile.primary_use_case ?? "");
  const [referralSource, setReferralSource] = useState(profile.referral_source ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(profile.display_name ?? "");
    setBirthYear(profile.birth_year != null ? String(profile.birth_year) : "");
    setCountryCode(profile.country_code ?? "");
    setLocale(profile.locale ?? "");
    setGenderIdentity(profile.gender_identity ?? "");
    setOccupation(profile.occupation ?? "");
    setIndustry(profile.industry ?? "");
    setWorkRole(profile.work_role ?? "");
    setCompanySize(profile.company_size ?? "");
    setPrimaryUseCase(profile.primary_use_case ?? "");
    setReferralSource(profile.referral_source ?? "");
  }, [profile]);

  async function saveSurvey() {
    if (!canManage) return;
    setBusy(true);
    setMsg(null);
    const y = birthYear.trim();
    let birth_year: number | null = null;
    if (y) {
      const n = Number.parseInt(y, 10);
      const maxY = new Date().getFullYear();
      if (Number.isNaN(n) || n < 1900 || n > maxY) {
        setMsg(`Birth year must be between 1900 and ${maxY}.`);
        setBusy(false);
        return;
      }
      birth_year = n;
    }
    const cc = countryCode.trim().toUpperCase();
    if (cc && cc.length !== 2) {
      setMsg("Country must be a 2-letter ISO code (e.g. GB) or empty.");
      setBusy(false);
      return;
    }

    const body = {
      display_name: displayName.trim() || null,
      birth_year,
      country_code: cc || null,
      locale: locale.trim() || null,
      gender_identity: genderIdentity.trim() || null,
      occupation: occupation.trim() || null,
      industry: industry.trim() || null,
      work_role: workRole.trim() || null,
      company_size: companySize || null,
      primary_use_case: primaryUseCase.trim() || null,
      referral_source: referralSource.trim() || null,
    };

    try {
      const res = await adminApi(`/api/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok) {
        setMsg(typeof data.error === "string" ? data.error : "Could not save survey.");
        return;
      }
      const next = data.data as AdminProfile;
      if (next) {
        onProfileSaved(next);
        setMsg("Survey profile saved.");
      }
    } catch {
      setBusy(false);
      setMsg("Could not save survey.");
    }
  }

  return (
    <div className="space-y-6">
      {!canManage && (
        <p className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-muted">
          View only. Staff with manage access can edit survey fields for support or data cleanup.
        </p>
      )}
      <p className="text-sm text-muted">
        <span className="font-medium text-foreground">Nothing here is required</span> for a user to use Recount — these
        are voluntary fields for audience analytics. Users can edit their own answers in Settings. Values roll up to the
        staff <strong className="text-foreground">Audience</strong> dashboard.
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        <FieldWithHint
          id={`admin-survey-name-${userId}`}
          label="Display name"
          hint="Preferred name; may differ from email."
        >
          <input
            id={`admin-survey-name-${userId}`}
            className={inputClass}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={!canManage}
            maxLength={120}
          />
        </FieldWithHint>
        <FieldWithHint
          id={`admin-survey-birth-${userId}`}
          label="Birth year"
          hint="Year only (cohort analytics). Leave blank if unknown."
        >
          <input
            id={`admin-survey-birth-${userId}`}
            className={inputClass}
            inputMode="numeric"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
            disabled={!canManage}
            placeholder="e.g. 1992"
          />
        </FieldWithHint>
        <FieldWithHint
          id={`admin-survey-cc-${userId}`}
          label="Country (ISO)"
          hint="Two-letter code, e.g. GB, US, DE."
        >
          <input
            id={`admin-survey-cc-${userId}`}
            className={inputClass}
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))}
            disabled={!canManage}
            maxLength={2}
          />
        </FieldWithHint>
        <FieldWithHint
          id={`admin-survey-locale-${userId}`}
          label="Locale (BCP-47)"
          hint="Optional, e.g. en-GB."
        >
          <input
            id={`admin-survey-locale-${userId}`}
            className={inputClass}
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            disabled={!canManage}
            maxLength={35}
          />
        </FieldWithHint>
        <FieldWithHint
          id={`admin-survey-gender-${userId}`}
          label="Gender identity"
          hint="Free text; keep inclusive and optional."
          className="sm:col-span-2"
        >
          <input
            id={`admin-survey-gender-${userId}`}
            className={inputClass}
            value={genderIdentity}
            onChange={(e) => setGenderIdentity(e.target.value)}
            disabled={!canManage}
            maxLength={80}
          />
        </FieldWithHint>
        <FieldWithHint id={`admin-survey-occ-${userId}`} label="Occupation" hint="Job title or role label.">
          <input
            id={`admin-survey-occ-${userId}`}
            className={inputClass}
            value={occupation}
            onChange={(e) => setOccupation(e.target.value)}
            disabled={!canManage}
            maxLength={100}
          />
        </FieldWithHint>
        <FieldWithHint id={`admin-survey-ind-${userId}`} label="Industry" hint="Sector or vertical.">
          <input
            id={`admin-survey-ind-${userId}`}
            className={inputClass}
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            disabled={!canManage}
            maxLength={100}
          />
        </FieldWithHint>
        <FieldWithHint id={`admin-survey-workrole-${userId}`} label="Work role" hint="e.g. IC, manager, founder.">
          <input
            id={`admin-survey-workrole-${userId}`}
            className={inputClass}
            value={workRole}
            onChange={(e) => setWorkRole(e.target.value)}
            disabled={!canManage}
            maxLength={80}
          />
        </FieldWithHint>
        <FieldWithHint id={`admin-survey-cosize-${userId}`} label="Company size" hint="Headcount band.">
          <select
            id={`admin-survey-cosize-${userId}`}
            className={inputClass}
            value={companySize}
            onChange={(e) => setCompanySize(e.target.value)}
            disabled={!canManage}
          >
            {COMPANY_SIZES.map((o) => (
              <option key={o.value || "empty"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FieldWithHint>
        <FieldWithHint
          id={`admin-survey-use-${userId}`}
          label="Primary use case"
          hint="Why they use Recount."
          className="sm:col-span-2"
        >
          <textarea
            id={`admin-survey-use-${userId}`}
            className={`${inputClass} min-h-[72px]`}
            value={primaryUseCase}
            onChange={(e) => setPrimaryUseCase(e.target.value)}
            disabled={!canManage}
            maxLength={200}
            rows={3}
          />
        </FieldWithHint>
        <FieldWithHint
          id={`admin-survey-ref-${userId}`}
          label="How they heard about us"
          hint="Attribution / referral source."
          className="sm:col-span-2"
        >
          <input
            id={`admin-survey-ref-${userId}`}
            className={inputClass}
            value={referralSource}
            onChange={(e) => setReferralSource(e.target.value)}
            disabled={!canManage}
            maxLength={100}
          />
        </FieldWithHint>
      </div>

      {profile.demographics_updated_at && (
        <p className="text-xs text-muted">
          Last survey update: {new Date(profile.demographics_updated_at).toLocaleString()}
        </p>
      )}

      {msg && <p className="text-sm text-muted">{msg}</p>}
      {canManage && (
        <Button type="button" disabled={busy} onClick={() => void saveSurvey()}>
          {busy ? "Saving…" : "Save survey"}
        </Button>
      )}
    </div>
  );
}
