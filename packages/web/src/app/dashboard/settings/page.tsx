"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FieldWithHint, ScaleWithHint, SwitchWithHint } from "@/components/ui/field-hint";
import { cn } from "@/lib/utils";
import {
  birthYearOptions,
  COUNTRY_OPTIONS,
  COMPANY_SIZE_OPTIONS,
  DEMO_CUSTOM,
  GENDER_OPTIONS,
  INDUSTRY_OPTIONS,
  LOCALE_OPTIONS,
  mergeSelectOrCustom,
  OCCUPATION_OPTIONS,
  PRIMARY_USE_CASE_OPTIONS,
  REFERRAL_OPTIONS,
  resolveSelect,
  WORK_ROLE_OPTIONS,
} from "./demographics-options";
import { getApiBaseUrl } from "@/lib/api-url";
import { useDashboardEntitlements } from "@/components/layout/dashboard-entitlements";
import { DistractionPresetPicker } from "./distraction-preset-picker";
import { getPresetHostSet, parseCustomDistractionLines } from "./distraction-presets";
import {
  CollapsibleSettingsBlock,
  FeatureSubsectionNav,
  SETTINGS_SECTIONS,
  SettingsSectionNav,
  useSettingsScrollSpy,
  useSettingsSectionOpenState,
} from "./settings-layout";

const inputClass =
  "mt-1 w-full rounded-md border border-white/10 bg-card px-3 py-2 text-foreground";

const selectClass = cn(
  inputClass,
  "cursor-pointer pr-10 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-white/15 focus-visible:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
);

type ProfileRow = {
  hourly_rate?: number;
  timezone?: string;
  license_active?: boolean;
  app_role?: string;
  distraction_domains?: string[];
  blocked_domains?: string[];
  intent_lock_enabled?: boolean;
  weekly_digest_enabled?: boolean;
  send_tab_titles?: boolean;
  team_slug?: string | null;
  leaderboard_opt_in?: boolean;
  leaderboard_nickname?: string | null;
  display_name?: string | null;
  birth_year?: number | null;
  country_code?: string | null;
  locale?: string | null;
  gender_identity?: string | null;
  occupation?: string | null;
  industry?: string | null;
  work_role?: string | null;
  company_size?: string | null;
  primary_use_case?: string | null;
  referral_source?: string | null;
  demographics_updated_at?: string | null;
};

function DemographicsSelect({
  id,
  label,
  hint,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <FieldWithHint id={id} label={label} hint={hint}>
      <select id={id} className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o, i) => (
          <option key={`${id}-${i}-${o.value}`} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldWithHint>
  );
}

function FeatureSubsection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-28 space-y-4 rounded-lg border border-white/10 bg-black/[0.18] px-4 py-4 sm:px-5"
    >
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const [hourly, setHourly] = useState("0");
  const [tz, setTz] = useState("UTC");
  /** Preset picker selection (hostnames, lowercase). */
  const [selectedPremadeHosts, setSelectedPremadeHosts] = useState<string[]>([]);
  /** Additional hostnames, one per line (not from the preset list). */
  const [distractionCustomText, setDistractionCustomText] = useState("");
  const [intentLock, setIntentLock] = useState(false);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [sendTitles, setSendTitles] = useState(true);
  const [teamSlug, setTeamSlug] = useState("");
  const [leaderOptIn, setLeaderOptIn] = useState(false);
  /** When false, distraction domains are cleared on save (extension treats as no custom list). */
  const [distractionListEnabled, setDistractionListEnabled] = useState(false);
  /** Hostnames the extension must never record (one per line). */
  const [blockedDomainsText, setBlockedDomainsText] = useState("");
  const [nickname, setNickname] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [birthYearSelect, setBirthYearSelect] = useState("");
  const [countrySelect, setCountrySelect] = useState("");
  const [countryOther, setCountryOther] = useState("");
  const [localeSelect, setLocaleSelect] = useState("");
  const [localeOther, setLocaleOther] = useState("");
  const [genderSelect, setGenderSelect] = useState("");
  const [genderOther, setGenderOther] = useState("");
  const [occupationSelect, setOccupationSelect] = useState("");
  const [occupationOther, setOccupationOther] = useState("");
  const [industrySelect, setIndustrySelect] = useState("");
  const [industryOther, setIndustryOther] = useState("");
  const [workRoleSelect, setWorkRoleSelect] = useState("");
  const [workRoleOther, setWorkRoleOther] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [primaryUseSelect, setPrimaryUseSelect] = useState("");
  const [primaryUseOther, setPrimaryUseOther] = useState("");
  const [referralSelect, setReferralSelect] = useState("");
  const [referralOther, setReferralOther] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const ent = useDashboardEntitlements();
  const [sectionOpen, setSectionOpen] = useSettingsSectionOpenState();
  const activeNavId = useSettingsScrollSpy(SETTINGS_SECTIONS.map((s) => s.id));

  function navigateToSection(id: string) {
    setSectionOpen((prev) => ({ ...prev, [id]: true }));
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function navigateToFeatureSub(anchorId: string) {
    setSectionOpen((prev) => ({ ...prev, "settings-features": true }));
    requestAnimationFrame(() => {
      document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setProfileError(null);
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token || cancelled) return;
      let res: Response;
      try {
        res = await fetch(`${getApiBaseUrl()}/api/profiles/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        if (cancelled) return;
        setProfileError(
          "Could not reach the API. Run `npm run dev:api` from the repo root, confirm the URL in packages/web `.env.local` (NEXT_PUBLIC_API_URL), and match your browser address (localhost vs 127.0.0.1) to API ALLOWED_ORIGINS."
        );
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        setProfileError(typeof body.error === "string" ? body.error : `Could not load profile (${res.status}).`);
        return;
      }
      if (!body.data) {
        setProfileError(typeof body.error === "string" ? body.error : "Could not load profile.");
        return;
      }
      const row = body.data as ProfileRow;
      setHourly(String(row.hourly_rate ?? 0));
      setTz(row.timezone ?? "UTC");
      const rawDomains = Array.isArray(row.distraction_domains)
        ? row.distraction_domains.map((h) => String(h).trim().toLowerCase()).filter(Boolean)
        : [];
      const presetSet = getPresetHostSet();
      const premade: string[] = [];
      const custom: string[] = [];
      for (const h of rawDomains) {
        if (presetSet.has(h)) premade.push(h);
        else custom.push(h);
      }
      setSelectedPremadeHosts([...new Set(premade)].sort());
      setDistractionCustomText([...new Set(custom)].sort().join("\n"));
      setDistractionListEnabled(rawDomains.length > 0);
      setBlockedDomainsText(
        Array.isArray(row.blocked_domains) ? row.blocked_domains.map((h) => String(h).trim().toLowerCase()).filter(Boolean).sort().join("\n") : ""
      );
      setIntentLock(Boolean(row.intent_lock_enabled));
      setWeeklyDigest(Boolean(row.weekly_digest_enabled));
      setSendTitles(row.send_tab_titles !== false);
      setTeamSlug(row.team_slug ?? "");
      setLeaderOptIn(Boolean(row.leaderboard_opt_in));
      setNickname(row.leaderboard_nickname ?? "");
      setDisplayName(row.display_name ?? "");
      setBirthYearSelect(row.birth_year != null ? String(row.birth_year) : "");
      const co = resolveSelect(row.country_code, COUNTRY_OPTIONS, DEMO_CUSTOM);
      setCountrySelect(co.select);
      setCountryOther(co.other);
      const loc = resolveSelect(row.locale, LOCALE_OPTIONS, DEMO_CUSTOM);
      setLocaleSelect(loc.select);
      setLocaleOther(loc.other);
      const g = resolveSelect(row.gender_identity, GENDER_OPTIONS, DEMO_CUSTOM);
      setGenderSelect(g.select);
      setGenderOther(g.other);
      const occ = resolveSelect(row.occupation, OCCUPATION_OPTIONS, DEMO_CUSTOM);
      setOccupationSelect(occ.select);
      setOccupationOther(occ.other);
      const ind = resolveSelect(row.industry, INDUSTRY_OPTIONS, DEMO_CUSTOM);
      setIndustrySelect(ind.select);
      setIndustryOther(ind.other);
      const wr = resolveSelect(row.work_role, WORK_ROLE_OPTIONS, DEMO_CUSTOM);
      setWorkRoleSelect(wr.select);
      setWorkRoleOther(wr.other);
      setCompanySize(row.company_size ?? "");
      const pu = resolveSelect(row.primary_use_case, PRIMARY_USE_CASE_OPTIONS, DEMO_CUSTOM);
      setPrimaryUseSelect(pu.select);
      setPrimaryUseOther(pu.other);
      const ref = resolveSelect(row.referral_source, REFERRAL_OPTIONS, DEMO_CUSTOM);
      setReferralSelect(ref.select);
      setReferralOther(ref.other);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function getToken() {
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token ?? null;
  }

  async function saveProfile() {
    setMsg(null);
    const token = await getToken();
    if (!token) {
      setMsg("Sign in again.");
      return;
    }
    const y = birthYearSelect.trim();
    let birth_year: number | null = null;
    if (y) {
      const n = Number.parseInt(y, 10);
      const maxY = new Date().getFullYear();
      if (Number.isNaN(n) || n < 1900 || n > maxY) {
        setMsg(`Birth year must be between 1900 and ${maxY}.`);
        return;
      }
      birth_year = n;
    }
    const countryMerged = mergeSelectOrCustom(countrySelect, countryOther, DEMO_CUSTOM);
    let country_code: string | null = null;
    if (countryMerged) {
      const cc = countryMerged.trim().toUpperCase();
      if (cc.length !== 2 || !/^[A-Z]{2}$/.test(cc)) {
        setMsg("Country must be a 2-letter ISO code (choose from the list or enter one below).");
        return;
      }
      country_code = cc;
    }
    const localeMerged = mergeSelectOrCustom(localeSelect, localeOther, DEMO_CUSTOM);
    if (localeMerged && localeMerged.length > 35) {
      setMsg("Locale tag is too long (max 35 characters).");
      return;
    }
    const genderMerged = mergeSelectOrCustom(genderSelect, genderOther, DEMO_CUSTOM);
    if (genderMerged && genderMerged.length > 80) {
      setMsg("Gender identity text is too long (max 80 characters).");
      return;
    }
    const occMerged = mergeSelectOrCustom(occupationSelect, occupationOther, DEMO_CUSTOM);
    if (occMerged && occMerged.length > 100) {
      setMsg("Occupation is too long (max 100 characters).");
      return;
    }
    const indMerged = mergeSelectOrCustom(industrySelect, industryOther, DEMO_CUSTOM);
    if (indMerged && indMerged.length > 100) {
      setMsg("Industry is too long (max 100 characters).");
      return;
    }
    const workMerged = mergeSelectOrCustom(workRoleSelect, workRoleOther, DEMO_CUSTOM);
    if (workMerged && workMerged.length > 80) {
      setMsg("Role type is too long (max 80 characters).");
      return;
    }
    const useMerged = mergeSelectOrCustom(primaryUseSelect, primaryUseOther, DEMO_CUSTOM);
    if (useMerged && useMerged.length > 200) {
      setMsg("Use case description is too long (max 200 characters).");
      return;
    }
    const refMerged = mergeSelectOrCustom(referralSelect, referralOther, DEMO_CUSTOM);
    if (refMerged && refMerged.length > 100) {
      setMsg("Referral source is too long (max 100 characters).");
      return;
    }
    const customHosts = parseCustomDistractionLines(distractionCustomText);
    const presetLower = selectedPremadeHosts.map((h) => h.trim().toLowerCase()).filter(Boolean);
    const seen = new Set<string>();
    const distraction_domains: string[] = [];
    if (distractionListEnabled) {
      for (const h of [...presetLower, ...customHosts]) {
        if (seen.has(h)) continue;
        seen.add(h);
        distraction_domains.push(h);
      }
    }
    if (distraction_domains.length > 100) {
      setMsg("Too many distraction domains (max 100). Remove some presets or custom lines.");
      return;
    }
    const blocked_domains = parseCustomDistractionLines(blockedDomainsText);
    if (blocked_domains.length > 100) {
      setMsg("Too many never-track domains (max 100). Remove some lines from the blocklist.");
      return;
    }
    const res = await fetch(`${getApiBaseUrl()}/api/profiles`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        hourly_rate: Number(hourly) || 0,
        timezone: tz,
        distraction_domains,
        intent_lock_enabled: intentLock,
        weekly_digest_enabled: weeklyDigest,
        send_tab_titles: sendTitles,
        team_slug: teamSlug.trim() || null,
        leaderboard_opt_in: leaderOptIn,
        leaderboard_nickname: nickname.trim() || null,
        display_name: displayName.trim() || null,
        birth_year,
        country_code,
        locale: localeMerged?.trim() || null,
        gender_identity: genderMerged?.trim() || null,
        occupation: occMerged?.trim() || null,
        industry: indMerged?.trim() || null,
        work_role: workMerged?.trim() || null,
        company_size: companySize || null,
        primary_use_case: useMerged?.trim() || null,
        referral_source: refMerged?.trim() || null,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setMsg(
      res.ok
        ? "Saved. Reload the browser extension if it is open so distraction list, blocklist, and other prefs sync."
        : (body.error ?? "Could not save")
    );
  }

  async function exportCsv() {
    setMsg(null);
    const token = await getToken();
    if (!token) {
      setMsg("Sign in again.");
      return;
    }
    const days = ent.fullAccess ? 30 : 7;
    const lines = ["date,domain,minutes,category"];
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const date = d.toISOString().slice(0, 10);
      const res = await fetch(`${getApiBaseUrl()}/api/events/summary?date=${date}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) continue;
      for (const dom of body.data?.domains ?? []) {
        lines.push(
          `${date},${dom.domain},${Math.round(dom.seconds / 60)},${dom.category ?? ""}`
        );
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "recount-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadIcs() {
    setMsg(null);
    const token = await getToken();
    if (!token) {
      setMsg("Sign in again.");
      return;
    }
    const res = await fetch(`${getApiBaseUrl()}/api/events/me/calendar.ics`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setMsg(err.error ?? "Could not download calendar.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "recount-activity.ics";
    a.click();
    URL.revokeObjectURL(url);
    setMsg("Calendar file downloaded.");
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
        <aside className="lg:sticky lg:top-24 lg:w-52 lg:shrink-0">
          <p className="mb-2 hidden text-xs font-medium uppercase tracking-wide text-muted lg:block">Jump to</p>
          <SettingsSectionNav activeId={activeNavId} onNavigate={navigateToSection} />
        </aside>

        <div className="min-w-0 flex-1 space-y-6 lg:max-w-2xl">
          <div id="settings-overview" className="scroll-mt-28 space-y-3">
            <h1 className="text-2xl font-semibold">Settings</h1>
            <p className="text-sm text-muted">Saved via the Recount API (synced to your profile).</p>
            <p className="text-sm text-muted">
              <span className="font-medium text-foreground">Plan:</span> {ent.planLabel}
              {" · "}
              <span className="font-medium text-foreground">Role:</span>{" "}
              {ent.loading && !ent.ready ? "…" : ent.appRole}
            </p>
            {ent.error && <p className="text-xs text-amber-200/90">Account status: {ent.error}</p>}
            {profileError && <p className="text-xs text-amber-200/90">Profile form: {profileError}</p>}
          </div>

          <CollapsibleSettingsBlock
            id="settings-general"
            title="General"
            description="Hourly rate and timezone"
            open={sectionOpen["settings-general"]}
            onOpenChange={(o) => setSectionOpen((p) => ({ ...p, "settings-general": o }))}
          >
            <FieldWithHint
              id="settings-hourly-rate"
              label="Hourly rate (£)"
              hint="Roughly what one hour of your time is worth to you, in pounds. Recount saves this on your profile for context in the product (for example future reports or value summaries). It is not your subscription price and is not sent to payment providers."
            >
              <input
                id="settings-hourly-rate"
                className={inputClass}
                type="number"
                min={0}
                step="0.01"
                value={hourly}
                onChange={(e) => setHourly(e.target.value)}
              />
            </FieldWithHint>
            <FieldWithHint
              id="settings-timezone"
              label="Timezone (IANA, e.g. Europe/London)"
              hint="Used so dates and “today” in the app match your locale. Use a standard IANA name (e.g. Europe/London, America/Toronto). If unsure, UTC is fine."
            >
              <input id="settings-timezone" className={inputClass} value={tz} onChange={(e) => setTz(e.target.value)} />
            </FieldWithHint>
          </CollapsibleSettingsBlock>

          <CollapsibleSettingsBlock
            id="settings-about"
            title="About you"
            description="Optional demographics — entirely skippable"
            open={sectionOpen["settings-about"]}
            onOpenChange={(o) => setSectionOpen((p) => ({ ...p, "settings-about": o }))}
          >
        <p className="text-sm text-muted">
          <span className="font-medium text-foreground">Entirely optional.</span> You can ignore this whole block —
          nothing here is required to use Recount. Pick from the menus for faster input; use “other” rows when you need
          your own wording. We aggregate responses to improve the product; we don’t sell this data. Clear any field by
          choosing the skip option at the top of each list.
        </p>
        <FieldWithHint
          id="settings-display-name"
          label="Preferred name (optional)"
          hint="How you’d like to be addressed in the product or future emails. Free text — not everyone fits a dropdown."
        >
          <input
            id="settings-display-name"
            className={inputClass}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={120}
            aria-required={false}
          />
        </FieldWithHint>
        <div className="grid gap-4 sm:grid-cols-2">
          <DemographicsSelect
            id="settings-birth-year"
            label="Birth year (optional)"
            hint="Year only, for broad age-cohort trends. Large scrollable list — or skip."
            options={birthYearOptions()}
            value={birthYearSelect}
            onChange={setBirthYearSelect}
          />
          <DemographicsSelect
            id="settings-country"
            label="Country (optional)"
            hint="ISO 3166-1 alpha-2 list. Choose “Other” to type a two-letter code if yours isn’t listed."
            options={COUNTRY_OPTIONS}
            value={countrySelect}
            onChange={setCountrySelect}
          />
          <DemographicsSelect
            id="settings-locale"
            label="Locale / language tag (optional)"
            hint="BCP-47 tags (language + region). Common tags are listed; pick Other for a custom tag up to 35 characters."
            options={LOCALE_OPTIONS}
            value={localeSelect}
            onChange={setLocaleSelect}
          />
          <DemographicsSelect
            id="settings-company-size"
            label="Company or team size (optional)"
            hint="Rough headcount. Matches how we bucket organizations in analytics."
            options={COMPANY_SIZE_OPTIONS}
            value={companySize}
            onChange={setCompanySize}
          />
        </div>
        {countrySelect === DEMO_CUSTOM ? (
          <FieldWithHint
            id="settings-country-custom"
            label="Country code (2 letters)"
            hint="Examples: GB, US, DE, NG, IN. Uppercase Latin letters only."
          >
            <input
              id="settings-country-custom"
              className={inputClass}
              value={countryOther}
              onChange={(e) => setCountryOther(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))}
              maxLength={2}
              placeholder="GB"
            />
          </FieldWithHint>
        ) : null}
        {localeSelect === DEMO_CUSTOM ? (
          <FieldWithHint
            id="settings-locale-custom"
            label="Custom locale tag"
            hint="e.g. en-GB, pt-BR, cmn-TW. Max 35 characters."
          >
            <input
              id="settings-locale-custom"
              className={inputClass}
              value={localeOther}
              onChange={(e) => setLocaleOther(e.target.value.slice(0, 35))}
              maxLength={35}
            />
          </FieldWithHint>
        ) : null}
        <DemographicsSelect
          id="settings-gender"
          label="Gender identity (optional)"
          hint="Inclusive shorthand list. Choose “Something else” to write your own words (max 80 characters)."
          options={GENDER_OPTIONS}
          value={genderSelect}
          onChange={setGenderSelect}
        />
        {genderSelect === DEMO_CUSTOM ? (
          <FieldWithHint
            id="settings-gender-custom"
            label="Describe in your own words"
            hint="Whatever label fits you best. Kept private; used only in aggregate."
          >
            <input
              id="settings-gender-custom"
              className={inputClass}
              value={genderOther}
              onChange={(e) => setGenderOther(e.target.value.slice(0, 80))}
              maxLength={80}
            />
          </FieldWithHint>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <DemographicsSelect
            id="settings-occupation"
            label="Occupation (optional)"
            hint="Job family / title cluster. Other → free text up to 100 characters."
            options={OCCUPATION_OPTIONS}
            value={occupationSelect}
            onChange={setOccupationSelect}
          />
          <DemographicsSelect
            id="settings-industry"
            label="Industry (optional)"
            hint="Sector you work in. Other → specify below."
            options={INDUSTRY_OPTIONS}
            value={industrySelect}
            onChange={setIndustrySelect}
          />
          <DemographicsSelect
            id="settings-work-role"
            label="Role type (optional)"
            hint="Seniority / relationship to org — not the same as job title."
            options={WORK_ROLE_OPTIONS}
            value={workRoleSelect}
            onChange={setWorkRoleSelect}
          />
        </div>
        {(occupationSelect === DEMO_CUSTOM || industrySelect === DEMO_CUSTOM || workRoleSelect === DEMO_CUSTOM) && (
          <div className="grid gap-4 sm:grid-cols-1">
            {occupationSelect === DEMO_CUSTOM ? (
              <FieldWithHint
                id="settings-occupation-custom"
                label="Occupation (your wording)"
                hint="Job title or short description, max 100 characters."
              >
                <input
                  id="settings-occupation-custom"
                  className={inputClass}
                  value={occupationOther}
                  onChange={(e) => setOccupationOther(e.target.value.slice(0, 100))}
                  maxLength={100}
                />
              </FieldWithHint>
            ) : null}
            {industrySelect === DEMO_CUSTOM ? (
              <FieldWithHint
                id="settings-industry-custom"
                label="Industry (your wording)"
                hint="Sector or niche, max 100 characters."
              >
                <input
                  id="settings-industry-custom"
                  className={inputClass}
                  value={industryOther}
                  onChange={(e) => setIndustryOther(e.target.value.slice(0, 100))}
                  maxLength={100}
                />
              </FieldWithHint>
            ) : null}
            {workRoleSelect === DEMO_CUSTOM ? (
              <FieldWithHint
                id="settings-work-role-custom"
                label="Role type (your wording)"
                hint="e.g. fractional CMO, apprentice electrician. Max 80 characters."
              >
                <input
                  id="settings-work-role-custom"
                  className={inputClass}
                  value={workRoleOther}
                  onChange={(e) => setWorkRoleOther(e.target.value.slice(0, 80))}
                  maxLength={80}
                />
              </FieldWithHint>
            ) : null}
          </div>
        )}
        <DemographicsSelect
          id="settings-use-case"
          label="What will you use Recount for? (optional)"
          hint="Helps us prioritize roadmap items. Pick the closest fit or describe your own scenario below."
          options={PRIMARY_USE_CASE_OPTIONS}
          value={primaryUseSelect}
          onChange={setPrimaryUseSelect}
        />
        {primaryUseSelect === DEMO_CUSTOM ? (
          <FieldWithHint
            id="settings-use-case-custom"
            label="Describe your use case"
            hint="Up to 200 characters — a sentence or two is perfect."
          >
            <textarea
              id="settings-use-case-custom"
              className={cn(inputClass, "min-h-[88px] resize-y")}
              value={primaryUseOther}
              onChange={(e) => setPrimaryUseOther(e.target.value.slice(0, 200))}
              maxLength={200}
              rows={4}
            />
          </FieldWithHint>
        ) : null}
        <DemographicsSelect
          id="settings-referral"
          label="How did you hear about us? (optional)"
          hint="Attribution helps us invest in the right channels. Other → short free text."
          options={REFERRAL_OPTIONS}
          value={referralSelect}
          onChange={setReferralSelect}
        />
        {referralSelect === DEMO_CUSTOM ? (
          <FieldWithHint
            id="settings-referral-custom"
            label="Tell us where"
            hint="Blog, colleague name, subreddit, etc. Max 100 characters."
          >
            <input
              id="settings-referral-custom"
              className={inputClass}
              value={referralOther}
              onChange={(e) => setReferralOther(e.target.value.slice(0, 100))}
              maxLength={100}
            />
          </FieldWithHint>
        ) : null}
          </CollapsibleSettingsBlock>

          <CollapsibleSettingsBlock
            id="settings-features"
            title="Features"
            description="Turn product behaviour on or off and tune how much detail is stored"
            open={sectionOpen["settings-features"]}
            onOpenChange={(o) => setSectionOpen((p) => ({ ...p, "settings-features": o }))}
          >
            <p className="text-sm text-muted">
              These options sync to your profile and the browser extension (reload the extension after saving). Use the
              links on the left on large screens to jump within this section.
            </p>
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
              <div className="lg:sticky lg:top-28 lg:w-40 lg:shrink-0">
                <p className="mb-2 hidden text-xs font-medium uppercase tracking-wide text-muted lg:block">
                  In features
                </p>
                <FeatureSubsectionNav onNavigate={navigateToFeatureSub} />
              </div>
              <div className="min-w-0 flex-1 space-y-8">
                <FeatureSubsection
                  id="features-never-track"
                  title="Never track these sites"
                  description="The browser extension will not record time on matching hostnames or their subdomains (e.g. online banking)."
                >
                  <FieldWithHint
                    id="settings-blocked-domains"
                    label="Domain blocklist"
                    hint="One hostname per line, no https://. Matches the exact host and subdomains (same rules as the extension). This list is saved on your profile and applied when the extension syncs— you can still edit it in the extension’s Options page; the profile copy wins on the next sync."
                  >
                    <textarea
                      id="settings-blocked-domains"
                      className={cn(inputClass, "font-mono text-sm")}
                      rows={6}
                      value={blockedDomainsText}
                      onChange={(e) => setBlockedDomainsText(e.target.value)}
                      placeholder={"bank.example.com\nhealth-provider.nhs.uk"}
                    />
                  </FieldWithHint>
                </FeatureSubsection>

                <FeatureSubsection
                  id="features-extension"
                  title="Browser extension"
                  description="What the extension sends and whether intent-lock nudges run."
                >
                  <ScaleWithHint
                    id="settings-scale-tab-detail"
                    label="Activity detail from the browser"
                    hint="Controls whether uploaded time segments include the active tab’s page title. Domains and timing are always recorded when the extension is on."
                    min={0}
                    max={1}
                    step={1}
                    value={sendTitles ? 1 : 0}
                    onChange={(v) => setSendTitles(v >= 1)}
                    leftLabel="Domains and time only"
                    rightLabel="Include page titles"
                    valueDescription={sendTitles ? "Richer activity views; titles may contain sensitive words." : "More private; reports show sites without page titles."}
                  />
                  <SwitchWithHint
                    checked={intentLock}
                    onChange={setIntentLock}
                    label="Intent lock nudges"
                    hint="When on, if you saved goals for today (UTC) in the extension, Recount can show a notification and in-page banner when you focus a tab on a distraction domain you list below. The extension must be signed in; prefs sync about every 30 minutes or on startup."
                  />
                </FeatureSubsection>

                <FeatureSubsection
                  id="features-distractions"
                  title="Distractions"
                  description="Pick common sites from the list or add your own hostnames when intent lock is on."
                >
                  <SwitchWithHint
                    checked={distractionListEnabled}
                    onChange={setDistractionListEnabled}
                    label="Use a distraction list"
                    hint="When off, no hostnames are saved and the extension won’t use a custom list for intent-lock nudges. Turn on to choose presets and/or add your own sites below. Tracking still runs; this only affects nudges."
                  />
                  <FieldWithHint
                    id="settings-distraction-presets"
                    label="Common distraction sites"
                    hint="Search and tick sites you want nudges on. Per category you can use All / None. These merge with any custom hostnames you add underneath. Max 100 hostnames total when you save."
                  >
                    <DistractionPresetPicker
                      disabled={!distractionListEnabled}
                      value={selectedPremadeHosts}
                      onChange={setSelectedPremadeHosts}
                    />
                  </FieldWithHint>
                  <FieldWithHint
                    id="settings-distraction-custom"
                    label="Custom hostnames (optional)"
                    hint="One hostname per line, no https://. Use this for sites not in the list above (e.g. a niche forum or internal tool hostname)."
                  >
                    <textarea
                      id="settings-distraction-custom"
                      className={cn(inputClass, "font-mono text-sm", !distractionListEnabled && "opacity-50")}
                      rows={4}
                      value={distractionCustomText}
                      onChange={(e) => setDistractionCustomText(e.target.value)}
                      placeholder={"news.ycombinator.com\nexample-internal.app"}
                      disabled={!distractionListEnabled}
                      aria-disabled={!distractionListEnabled}
                    />
                  </FieldWithHint>
                </FeatureSubsection>

                <FeatureSubsection
                  id="features-email"
                  title="Email"
                  description="Optional product email when your server runs the digest job."
                >
                  <SwitchWithHint
                    checked={weeklyDigest}
                    onChange={setWeeklyDigest}
                    label="Weekly digest email"
                    hint="If enabled, your account can be included when an operator runs the weekly digest job on the API (POST /api/jobs/weekly-digest with a secret). You’ll get one email summarizing tracked time and intentions for the previous Monday–Sunday in UTC. Your server must have Resend and DIGEST_JOB_SECRET configured."
                  />
                </FeatureSubsection>

                <FeatureSubsection
                  id="features-team"
                  title="Team leaderboard"
                  description="Share a slug with colleagues; choose visibility on the board."
                >
                  <ScaleWithHint
                    id="settings-scale-leaderboard"
                    label="Leaderboard visibility"
                    hint="When visible, others with the same team slug can see your nickname and this UTC week’s tracked minutes. They never see your email."
                    min={0}
                    max={1}
                    step={1}
                    value={leaderOptIn ? 1 : 0}
                    onChange={(v) => setLeaderOptIn(v >= 1)}
                    leftLabel="Hidden from the board"
                    rightLabel="Visible with nickname"
                    valueDescription={
                      leaderOptIn
                        ? "You appear for teammates with the same slug."
                        : "Your minutes stay private; keep a slug for later if you like."
                    }
                  />
                  <FieldWithHint
                    id="settings-team-slug"
                    label="Team slug"
                    hint="A shared label for your group (e.g. company or squad). Everyone who enters the same slug and opts into the leaderboard appears in one list. Use lowercase letters, numbers, and hyphens only (2–64 characters)."
                  >
                    <input
                      id="settings-team-slug"
                      className={inputClass}
                      value={teamSlug}
                      onChange={(e) => setTeamSlug(e.target.value.toLowerCase())}
                      placeholder="acme-design"
                    />
                  </FieldWithHint>
                  <FieldWithHint
                    id="settings-leaderboard-nickname"
                    label="Leaderboard nickname"
                    hint="Name shown next to your weekly minutes on the Team page. Max 80 characters."
                  >
                    <input
                      id="settings-leaderboard-nickname"
                      className={inputClass}
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      maxLength={80}
                      placeholder="Alex"
                    />
                  </FieldWithHint>
                </FeatureSubsection>
              </div>
            </div>
          </CollapsibleSettingsBlock>

          <section
            id="settings-save"
            className="scroll-mt-28 rounded-xl border border-white/10 bg-card/30 px-4 py-4 sm:px-5"
          >
            <p className="text-sm text-muted">Apply changes to your profile (and sync extension prefs on next sync).</p>
            <Button className="mt-3" onClick={saveProfile}>
              Save settings
            </Button>
          </section>

          <CollapsibleSettingsBlock
            id="settings-export"
            title="Export"
            description="CSV and calendar download"
            open={sectionOpen["settings-export"]}
            onOpenChange={(o) => setSectionOpen((p) => ({ ...p, "settings-export": o }))}
          >
        <p className="text-sm text-muted">
          CSV of domain totals per day ({ent.fullAccess ? "30" : "7"} days).
        </p>
        <Button variant="secondary" className="mt-3" onClick={exportCsv}>
          Download CSV
        </Button>
        <p className="mt-4 text-sm text-muted">
          Subscribe in Google Calendar or Apple Calendar with the ICS feed (default range: {ent.fullAccess ? "30" : "7"}{" "}
          UTC days).
        </p>
        <Button variant="secondary" className="mt-3" onClick={downloadIcs}>
          Download ICS
        </Button>
          </CollapsibleSettingsBlock>

          {msg && <p className="text-sm text-muted">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
