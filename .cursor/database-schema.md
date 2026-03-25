# Recount database schema (Supabase / Postgres)

**Source of truth:** `packages/api/src/db/migrations/` (apply in order: `001` → `005`).

The **Express API** uses the Supabase **service role** client and **bypasses RLS**. The **Next.js web app** uses the **anon key + user JWT** and is subject to RLS and table **`GRANT`**s (`005`).

### PostgREST security model (after `005`)

| Table | RLS | JWT client (`authenticated`) | API (`service_role`) |
|-------|-----|------------------------------|----------------------|
| `profiles` | On | `SELECT` own row only (`profiles_select_own` + `GRANT SELECT`) | Full |
| `intentions` | On | No policies → no access | Full |
| `tab_events` | On | No policies → no access | Full |
| `reports` | On | No policies → no access | Full |
| `payments` | On | No policies → no access | Full |

**Classification:** `profiles` = **S1** (user read own); other app tables = **S0** (service only). See `.cursor/rules/supabase-security.mdc` when adding tables.

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

**RLS:** enabled. **Policy (after `004`):** `profiles_select_own` — `FOR SELECT` `TO authenticated` `USING (auth.uid() = id)` only. **`GRANT` (after `005`):** `REVOKE`d from `PUBLIC`; `GRANT SELECT` to `authenticated`; `service_role` has full privileges. Clients cannot `UPDATE` their own row via PostgREST; profile updates go through the API.

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

**RLS:** enabled. **Policies for `authenticated`:** none after `005` (API-only). **`GRANT`:** `REVOKE`d from `PUBLIC`; `service_role` has full privileges.

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

**Trigger:** `tab_events_derive_fields` `BEFORE INSERT OR UPDATE` → sets `date` (UTC date of `start_time`) and `duration_sec` from `start_time`/`end_time`.

**RLS:** enabled. **Policies for `authenticated`:** none after `005` (API-only). **`GRANT`:** `REVOKE`d from `PUBLIC`; `service_role` has full privileges.

**Indexes:** `idx_tab_events_user_date (user_id, date)`, `idx_tab_events_domain (domain)`.

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

**RLS:** enabled. **Policies for `authenticated`:** none after `005` (API-only). **`GRANT`:** `REVOKE`d from `PUBLIC`; `service_role` has full privileges.

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

**RLS:** enabled. **Policies for `authenticated`:** none after `005` (API-only). **`GRANT`:** `REVOKE`d from `PUBLIC`; `service_role` has full privileges.

---

## App roles (application layer)

Canonical values match the DB check and `packages/shared` (`APP_ROLES`): **`user`**, **`admin`**, **`developer`**.

- **`license_active`**: billing / Pro features.
- **`app_role`**: staff capabilities (admin API routes, admin dashboard). **`admin`** and **`developer`** both have full elevated access in the app (`requireElevatedStaff`); **`user`** is everyone else. Independent of billing.

---

## Extensions

- `uuid-ossp` (for `uuid_generate_v4()`).
