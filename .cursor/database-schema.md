# Recount database schema (Supabase / Postgres)

**Source of truth:** `packages/api/src/db/migrations/` (apply in order: `001` → `010`).

The **Express API** uses the Supabase **service role** client and **bypasses RLS**. The **Next.js web app** uses the **anon key + user JWT** and is subject to RLS and table **`GRANT`**s (`005`).

### PostgREST security model (after `010`)

| Table | RLS | JWT client (`authenticated`) | API (`service_role`) |
|-------|-----|------------------------------|----------------------|
| `profiles` | On | `SELECT` own row **or** all rows if `app_role` ∈ `admin`,`developer` (`profiles_select_own_or_staff`) | Full |
| `intentions` | On | `SELECT` own rows **or** all if elevated staff (`intentions_select_own_or_staff` + `GRANT SELECT`) | Full |
| `tab_events` | On | Same pattern (`tab_events_select_own_or_staff`) | Full |
| `reports` | On | Same (`reports_select_own_or_staff`) | Full |
| `payments` | On | Same (`payments_select_own_or_staff`) | Full |
| `login_events` | On | Same (`login_events_select_own_or_staff`) | Full |

**Helper (`010`):** `public.current_user_is_elevated_staff()` — `SECURITY DEFINER`, reads only `profiles` where `id = auth.uid()` to test `app_role`; avoids RLS recursion. **`EXECUTE`** granted to `authenticated` and `service_role`; revoked from `PUBLIC`.

**Writes:** No `INSERT`/`UPDATE`/`DELETE` policies for `authenticated` on these tables — mutations stay on the **Express API** (service role). See `.cursor/rules/supabase-security.mdc` when adding tables.

---

## Auth linkage

- `public.profiles.id` = `auth.users.id` (1:1, `ON DELETE CASCADE`).
- New auth users get a profile row via trigger `on_auth_user_created` → `public.handle_new_user()` (`002_auth_profile_trigger.sql`).

---

## `public.profiles`

| Column               | Type        | Default   | Notes |
|----------------------|-------------|-----------|--------|
| `id`                 | UUID        | —         | PK, FK → `auth.users(id)` |
| `email`              | TEXT        | —         | NOT NULL |
| `stripe_customer_id` | TEXT        | —         | UNIQUE, nullable |
| `license_active`     | BOOLEAN     | `false`   | Paid / Pro features; set by Stripe webhook (not `app_role`) |
| `license_key`        | TEXT        | —         | UNIQUE, nullable |
| `hourly_rate`        | NUMERIC(8,2)| `0`       | |
| `timezone`           | TEXT        | `'UTC'`   | NOT NULL |
| `app_role`           | TEXT        | `'user'`  | NOT NULL; `CHECK (app_role IN ('user','admin','developer'))` — staff vs end user (`003_profile_app_role.sql`) |
| `created_at`         | TIMESTAMPTZ | `now()`   | |
| `updated_at`         | TIMESTAMPTZ | `now()`   | |
| `distraction_domains` | TEXT[]     | `'{}'`    | Hostnames for intent-lock nudges (API-managed). |
| `intent_lock_enabled` | BOOLEAN    | `false`   | Extension nudges when visiting distraction sites with goals set. |
| `weekly_digest_enabled` | BOOLEAN  | `false`   | Include user in weekly email job (`007`). |
| `send_tab_titles`   | BOOLEAN     | `true`    | When false, clients should omit titles on batch upload. |
| `team_slug`         | TEXT        | nullable  | Shared team id for leaderboard (lowercase slug). |
| `leaderboard_opt_in` | BOOLEAN    | `false`   | Show on team leaderboard. |
| `leaderboard_nickname` | TEXT     | nullable  | Display name on leaderboard (max 80 in app). |
| `display_name` | TEXT | nullable | Preferred name (`008`). |
| `birth_year` | SMALLINT | nullable | Cohort analytics; `CHECK` 1900–2100 (`008`). |
| `country_code` | CHAR(2) | nullable | ISO 3166-1 alpha-2, uppercase in app (`008`). |
| `locale` | TEXT | nullable | BCP-47, e.g. `en-GB` (`008`). |
| `gender_identity` | TEXT | nullable | Free text (`008`). |
| `occupation` | TEXT | nullable | Job title / label (`008`). |
| `industry` | TEXT | nullable | Sector (`008`). |
| `work_role` | TEXT | nullable | e.g. IC, manager (`008`). |
| `company_size` | TEXT | nullable | `1`, `2-10`, `11-50`, `51-200`, `201+`, `prefer_not_say` (`008`). |
| `primary_use_case` | TEXT | nullable | Why they use the product (`008`). |
| `referral_source` | TEXT | nullable | Attribution (`008`). |
| `demographics_updated_at` | TIMESTAMPTZ | nullable | Set when any survey field changes via API (`008`). |

All **`008`** survey columns are **voluntary**: no signup or in-app step requires them; defaults are null / empty.

**RLS:** enabled. **Policy (after `010`):** `profiles_select_own_or_staff` — `FOR SELECT` `TO authenticated` `USING (auth.uid() = id OR current_user_is_elevated_staff())`. **`GRANT` (after `005`/`010`):** `REVOKE`d from `PUBLIC`; `GRANT SELECT` to `authenticated`; `service_role` has full privileges. No client `UPDATE`/`INSERT`/`DELETE` via PostgREST; profile updates go through the API.

---

## `public.login_events`

Password (API) login and signup audit rows (`008`).

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID | PK, `uuid_generate_v4()` |
| `user_id` | UUID | FK → `profiles(id)` `ON DELETE CASCADE` |
| `occurred_at` | TIMESTAMPTZ | Default `now()` |
| `event_type` | TEXT | `login` \| `signup` |
| `provider` | TEXT | e.g. `password` |
| `user_agent` | TEXT | Truncated client UA |
| `ip_hash` | TEXT | Optional SHA-256 when `LOGIN_AUDIT_SALT` is set |

**RLS:** enabled. **`authenticated`:** `login_events_select_own_or_staff` (`SELECT` own or all if elevated staff); `GRANT SELECT` (`010`). **`service_role`:** full from `008`.

**Indexes:** `idx_login_events_user_occurred`, `idx_login_events_occurred`.

**RPC (`008`):** `public.admin_audience_dashboard()` → JSON aggregates (profile totals, survey breakdowns, login counts, top domains by duration last 30 UTC days). **`REVOKE` from `PUBLIC`**, **`GRANT EXECUTE` to `service_role`** only.

**RPC (`009`):** `public.admin_analytics_timeseries(p_days integer default 90)` → JSON with `days`, `start`, `end`, and `daily` array (per UTC day: `signups`, `login_events`, `login_only`, `signup_events_logged`, `tracked_minutes`, `tab_segments`, `active_users`, `reports`, `intentions`). Clamped `p_days` 7–366. **`REVOKE` from `PUBLIC`**, **`GRANT EXECUTE` to `service_role`** only.

**API:** `GET /api/admin/analytics/audience` (snapshot), `GET /api/admin/analytics/trends?days=…` (time series for charts).

---

## `public.intentions`

Daily goals per user.

| Column       | Type        | Default | Notes |
|--------------|-------------|---------|--------|
| `id`         | UUID        | `uuid_generate_v4()` | PK |
| `user_id`    | UUID        | —       | FK → `profiles(id)` |
| `date`       | DATE        | —       | |
| `goals`      | TEXT[]      | `'{}'`  | NOT NULL |
| `created_at` | TIMESTAMPTZ | `now()` | |

**Constraints:** `UNIQUE(user_id, date)`.

**RLS:** enabled. **`authenticated`:** `intentions_select_own_or_staff` (`SELECT`); `GRANT SELECT` (`010`). **`GRANT`:** `service_role` full from `005`.

**Index:** `idx_intentions_user_date (user_id, date)`.

---

## `public.tab_events`

Browser activity segments. `date` and `duration_sec` are set by trigger (not generated columns).

| Column         | Type        | Default | Notes |
|----------------|-------------|---------|--------|
| `id`           | UUID        | `uuid_generate_v4()` | PK |
| `user_id`      | UUID        | —       | FK → `profiles(id)` |
| `domain`       | TEXT        | —       | NOT NULL |
| `title`        | TEXT        | nullable | |
| `start_time`   | TIMESTAMPTZ | —       | NOT NULL |
| `end_time`     | TIMESTAMPTZ | nullable | |
| `duration_sec` | INTEGER     | nullable | Filled when `end_time` set |
| `category`     | TEXT        | nullable | |
| `date`         | DATE        | —       | NOT NULL; derived from `start_time` UTC |
| `created_at`   | TIMESTAMPTZ | `now()` | |
| `focus_session_id` | UUID    | nullable | Optional Pomodoro / focus session id (`007`). |

**Trigger:** `tab_events_derive_fields` `BEFORE INSERT OR UPDATE` → sets `date` (UTC date of `start_time`) and `duration_sec` from `start_time`/`end_time`.

**RLS:** enabled. **`authenticated`:** `tab_events_select_own_or_staff` (`SELECT`); `GRANT SELECT` (`010`).

**Indexes:** `idx_tab_events_user_date (user_id, date)`, `idx_tab_events_domain (domain)`.

**RPC (optional, `006_admin_tab_event_summary.sql`):** `public.admin_tab_event_summary(...)` — filtered aggregates for the admin Activity tab (counts, total duration, distinct days, top domains, category list). Called by the API with the **service role**; if not deployed, the API falls back to a sampled aggregate.

---

## `public.reports`

Per-user daily AI report.

| Column         | Type        | Default | Notes |
|----------------|-------------|---------|--------|
| `id`           | UUID        | `uuid_generate_v4()` | PK |
| `user_id`      | UUID        | —       | FK → `profiles(id)` |
| `date`         | DATE        | —       | |
| `ai_summary`   | TEXT        | —       | NOT NULL |
| `score`        | SMALLINT    | nullable | `CHECK (score BETWEEN 1 AND 10)` |
| `top_domains`  | JSONB       | nullable | |
| `goals_met`    | TEXT[]      | nullable | |
| `goals_missed` | TEXT[]      | nullable | |
| `generated_at` | TIMESTAMPTZ | `now()` | |

**Constraints:** `UNIQUE(user_id, date)`.

**RLS:** enabled. **`authenticated`:** `reports_select_own_or_staff` (`SELECT`); `GRANT SELECT` (`010`).

**Index:** `idx_reports_user_date (user_id, date)`.

---

## `public.payments`

Stripe payment records.

| Column              | Type        | Default | Notes |
|---------------------|-------------|---------|--------|
| `id`                | UUID        | `uuid_generate_v4()` | PK |
| `user_id`           | UUID        | —       | FK → `profiles(id)` |
| `stripe_payment_id` | TEXT        | —       | NOT NULL, UNIQUE |
| `amount_pence`      | INTEGER     | —       | NOT NULL |
| `currency`          | TEXT        | `'gbp'` | NOT NULL |
| `status`            | TEXT        | —       | NOT NULL |
| `created_at`        | TIMESTAMPTZ | `now()` | |

**RLS:** enabled. **`authenticated`:** `payments_select_own_or_staff` (`SELECT`); `GRANT SELECT` (`010`).

---

## App roles (application layer)

Canonical values match the DB check and `packages/shared` (`APP_ROLES`): **`user`**, **`admin`**, **`developer`**.

- **`license_active`**: billing / Pro features.
- **`app_role`**: staff capabilities (admin API routes, admin dashboard). **`admin`** and **`developer`** both have full elevated access in the app (`requireElevatedStaff`); **`user`** is everyone else. Independent of billing.

---

## Extensions

- `uuid-ossp` (for `uuid_generate_v4()`).
