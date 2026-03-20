-- App roles (staff vs end user). Separate from billing: see profiles.license_active.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS app_role TEXT NOT NULL DEFAULT 'user'
  CHECK (app_role IN ('user', 'admin', 'developer'));

COMMENT ON COLUMN public.profiles.app_role IS 'Access level: user | admin | developer. Not tied to Stripe.';

COMMENT ON COLUMN public.profiles.license_active IS 'Premium / paid features (set by Stripe webhook).';
