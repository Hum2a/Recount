# Extension security notes

Recount stores Supabase **access** and **refresh** tokens in `chrome.storage.local`, which is standard for many extensions but means any malicious or compromised extension on the same profile could theoretically attempt phishing; only install the official build from a source you trust.

**`web_accessible_resources`** (`content/eod-nudge.js`, `content/intent-nudge.js`) are injected into web pages by design. They must stay minimal (no secrets, no token hand-off into the page). Nudge scripts should continue using safe patterns such as `textContent`-only DOM updates.

The **Dev** tab in the popup is visible only to `admin` / `developer` roles. It logs HTTP status and response snippets for debugging; avoid pasting those logs into public channels if they might contain sensitive data.

For server-side posture (API, web CSP, Stripe, RLS), see the repo root **`SECURITY.md`** and **`docs/SECURITY_FINDINGS.md`**.
