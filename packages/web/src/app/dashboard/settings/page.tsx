"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckboxWithHint, FieldWithHint } from "@/components/ui/field-hint";
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

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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

export default function SettingsPage() {
  const [hourly, setHourly] = useState("0");
  const [tz, setTz] = useState("UTC");
  const [distractionText, setDistractionText] = useState("");
  const [intentLock, setIntentLock] = useState(false);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [sendTitles, setSendTitles] = useState(true);
  const [teamSlug, setTeamSlug] = useState("");
  const [leaderOptIn, setLeaderOptIn] = useState(false);
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
  const [licensed, setLicensed] = useState(false);
  const [appRole, setAppRole] = useState<string>("user");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token || cancelled) return;
      const res = await fetch(`${apiUrl}/api/profiles/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (cancelled || !body.data) return;
      const row = body.data as ProfileRow;
      setHourly(String(row.hourly_rate ?? 0));
      setTz(row.timezone ?? "UTC");
      setLicensed(Boolean(row.license_active));
      setAppRole(typeof row.app_role === "string" ? row.app_role : "user");
      setDistractionText(Array.isArray(row.distraction_domains) ? row.distraction_domains.join("\n") : "");
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
    const distraction_domains = distractionText
      .split("\n")
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean);
    const res = await fetch(`${apiUrl}/api/profiles`, {
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
    setMsg(res.ok ? "Saved. Reload the browser extension if it is open so intent-lock prefs sync." : (body.error ?? "Could not save"));
  }

  async function exportCsv() {
    setMsg(null);
    const token = await getToken();
    if (!token) {
      setMsg("Sign in again.");
      return;
    }
    const days = licensed ? 30 : 7;
    const lines = ["date,domain,minutes,category"];
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const date = d.toISOString().slice(0, 10);
      const res = await fetch(`${apiUrl}/api/events/summary?date=${date}`, {
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
    const res = await fetch(`${apiUrl}/api/events/me/calendar.ics`, {
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
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted">Saved via the Recount API (synced to your profile).</p>
        <p className="mt-3 text-sm text-muted">
          <span className="font-medium text-foreground">Plan:</span>{" "}
          {licensed ? "Premium (license active)" : "Free"}
          {" · "}
          <span className="font-medium text-foreground">Role:</span> {appRole}
        </p>
      </div>
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
      <div className="border-t border-white/10 pt-6 space-y-4">
        <h2 className="text-lg font-medium">About you</h2>
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
      </div>
      <div className="border-t border-white/10 pt-6 space-y-4">
        <h2 className="text-lg font-medium">Focus &amp; intent lock</h2>
        <p className="text-sm text-muted">
          Distraction hostnames (one per line, no <code className="text-foreground/80">https://</code>). When intent lock
          is on and you have goals for today, the extension nudges you on these sites. Reload the extension after saving.
        </p>
        <FieldWithHint
          id="settings-distraction-domains"
          label="Distraction domains"
          hint="Websites you want reminders about when you have set daily intentions (e.g. social or news). Enter hostnames only, one per line (e.g. youtube.com). Tracking still runs; this only controls nudges when intent lock is enabled and the extension is signed in."
        >
          <textarea
            id="settings-distraction-domains"
            className={`${inputClass} font-mono text-sm`}
            rows={5}
            value={distractionText}
            onChange={(e) => setDistractionText(e.target.value)}
            placeholder={"youtube.com\nreddit.com"}
          />
        </FieldWithHint>
        <CheckboxWithHint
          checked={intentLock}
          onChange={setIntentLock}
          label="Enable intent lock nudges (extension must be signed in)"
          hint="When on, if you saved goals for today (UTC) in the extension, Recount can show a notification and in-page banner when you focus a tab on a distraction domain. Syncs from these settings about every 30 minutes or when the extension starts."
        />
      </div>
      <div className="border-t border-white/10 pt-6 space-y-4">
        <h2 className="text-lg font-medium">Privacy &amp; email</h2>
        <CheckboxWithHint
          checked={sendTitles}
          onChange={setSendTitles}
          label="Send page titles with tab events (uncheck to record domains and time only)"
          hint="If checked, the browser extension includes the active tab’s title when it uploads time segments. If unchecked, only the domain and timing are stored—better for privacy, less detail in activity views."
        />
        <CheckboxWithHint
          checked={weeklyDigest}
          onChange={setWeeklyDigest}
          label="Weekly digest email (previous UTC week; requires Resend + cron calling the digest job)"
          hint="If enabled, your account can be included when an operator runs the weekly digest job on the API (POST /api/jobs/weekly-digest with a secret). You’ll get one email summarizing tracked time and intentions for the previous Monday–Sunday in UTC. Your server must have Resend and DIGEST_JOB_SECRET configured."
        />
      </div>
      <div className="border-t border-white/10 pt-6 space-y-4">
        <h2 className="text-lg font-medium">Team leaderboard</h2>
        <p className="text-sm text-muted">
          Use the same team slug as colleagues (lowercase letters, numbers, hyphens). Opt in to appear on the board with a
          display nickname.
        </p>
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
          hint="Name shown next to your weekly minutes on the Team page. It does not have to match your email. Max 80 characters. You can opt out anytime with the checkbox below."
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
        <CheckboxWithHint
          checked={leaderOptIn}
          onChange={setLeaderOptIn}
          label="Show me on the team leaderboard (this UTC week's tracked minutes)"
          hint="When enabled, other people with the same team slug can see your nickname and total tracked minutes for the current UTC week (Monday start). They never see your email. Turn off to hide yourself while keeping a team slug for later."
        />
      </div>
      <Button onClick={saveProfile}>Save settings</Button>
      <div className="border-t border-white/10 pt-6">
        <h2 className="text-lg font-medium">Export</h2>
        <p className="mt-1 text-sm text-muted">
          CSV of domain totals per day ({licensed ? "30" : "7"} days).
        </p>
        <Button variant="secondary" className="mt-3" onClick={exportCsv}>
          Download CSV
        </Button>
        <p className="mt-4 text-sm text-muted">
          Subscribe in Google Calendar or Apple Calendar with the ICS feed (default range: {licensed ? "30" : "7"} UTC
          days).
        </p>
        <Button variant="secondary" className="mt-3" onClick={downloadIcs}>
          Download ICS
        </Button>
      </div>
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </div>
  );
}
