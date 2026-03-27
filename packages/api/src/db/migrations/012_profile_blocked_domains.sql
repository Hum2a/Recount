-- Hostnames the extension must never record (same semantics as extension blockedDomains).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS blocked_domains TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.profiles.blocked_domains IS 'Never-track hostnames for the browser extension; managed via API; subdomains match.';
