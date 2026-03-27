import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Privacy Policy — Recount",
  description:
    "How Recount collects, uses, and protects your data across the website, API, and browser extension.",
};

const lastUpdated = "27 March 2026";

export default async function PrivacyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const privacyEmail = process.env.NEXT_PUBLIC_PRIVACY_EMAIL?.trim();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-10">
        <MarketingHeader user={user} loginHref="/login?next=%2Fprivacy" />
      </div>

      <article className="space-y-10 text-sm leading-relaxed text-muted">
        <header className="space-y-2 border-b border-border pb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Privacy Policy</h1>
          <p className="text-muted">Last updated: {lastUpdated}</p>
          <p>
            This policy describes how the <strong className="text-foreground/90">Recount</strong> service — the
            website, API, and optional browser extension — handles personal data. Recount helps you understand how
            you spend time in your browser by recording activity you choose to track and syncing it to your account.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-foreground">Who is responsible</h2>
          <p>
            The person or organisation operating this Recount deployment is the data controller for information
            processed through this site and API. If you use someone else’s hosted instance, that operator is
            responsible for how your data is handled; this policy describes typical Recount behaviour.
          </p>
          <p>
            <strong className="text-foreground/90">Privacy contact:</strong>{" "}
            {privacyEmail ? (
              <a href={`mailto:${privacyEmail}`} className="text-primary underline-offset-4 hover:underline">
                {privacyEmail}
              </a>
            ) : (
              <>
                Set <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground/80">NEXT_PUBLIC_PRIVACY_EMAIL</code>{" "}
                in your web environment so visitors can reach you. Until then, use the same channel you advertise for
                account support.
              </>
            )}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-foreground">What we collect</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground/90">Account and profile.</strong> Email address and authentication
              data managed by our auth provider (e.g. Supabase). Profile fields you set in the app, such as timezone,
              preferences, optional team nickname, distraction list, never-track blocklist, and whether to include tab
              titles with events or receive optional emails.
            </li>
            <li>
              <strong className="text-foreground/90">Tab activity (extension).</strong> When you grant normal website
              access, Recount records time spent on active browser tabs on <code className="text-xs">http</code> and{" "}
              <code className="text-xs">https</code> pages: at minimum the site domain and duration; optionally the
              page title if you leave that enabled. Internal browser pages, <code className="text-xs">file://</code>,
              and domains you block are not tracked as configured. Idle detection is used so long idle periods are not
              counted like active reading time.
            </li>
            <li>
              <strong className="text-foreground/90">Intentions and reports.</strong> Text you save as daily intentions.
              If you use AI accountability reports, the service sends relevant activity summaries and intentions to an AI
              provider to generate text; reports and scores are stored with your account.
            </li>
            <li>
              <strong className="text-foreground/90">Payments.</strong> One-time purchases are processed by our payment
              provider (e.g. Stripe). We do not store full card numbers on Recount servers; the provider handles card
              data according to its own terms.
            </li>
            <li>
              <strong className="text-foreground/90">Technical data.</strong> Like most web services, servers and
              infrastructure may log data such as IP address, approximate region, timestamps, and request metadata for
              security, debugging, and abuse prevention.
            </li>
            <li>
              <strong className="text-foreground/90">Optional email.</strong> If you opt in and the deployment is
              configured for it, we may send a weekly digest or transactional messages related to your account.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-foreground">How we use data</h2>
          <p>We use the data above to:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Provide core features: dashboards, activity views, history, exports, extension sync, and team leaderboard where enabled.</li>
            <li>Authenticate you and protect accounts.</li>
            <li>Process payments and license status.</li>
            <li>Generate optional AI reports when you request them.</li>
            <li>Send optional product emails you have opted into.</li>
            <li>Maintain security, fix bugs, and comply with law where required.</li>
          </ul>
          <p>
            We do <strong className="text-foreground/90">not</strong> sell your personal data. We do not use Recount
            data to determine creditworthiness or for lending. We do not use your browsing history to serve third-party
            advertising inside Recount.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-foreground">Legal bases (UK / EEA)</h2>
          <p>Where UK GDPR or EU GDPR applies, we rely on appropriate bases such as:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground/90">Contract</strong> — processing needed to provide the service you
              signed up for.
            </li>
            <li>
              <strong className="text-foreground/90">Legitimate interests</strong> — for example securing the service,
              understanding aggregate usage, and (where balanced) product improvement, provided your rights are
              respected.
            </li>
            <li>
              <strong className="text-foreground/90">Consent</strong> — where required (e.g. optional marketing email
              or extension permissions you explicitly grant).
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-foreground">Processors and transfers</h2>
          <p>
            We use trusted service providers to run Recount. Depending on how this deployment is hosted, that may
            include, for example: database and authentication (e.g. Supabase), payments (e.g. Stripe), AI inference
            (e.g. OpenAI), email delivery (e.g. Resend), and cloud / edge hosting. They process data on our instructions
            and under contractual safeguards where required.
          </p>
          <p>
            If data is stored or processed outside your country, we use appropriate mechanisms (such as standard
            contractual clauses) where applicable.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-foreground">Retention</h2>
          <p>
            We keep account and activity data while your account exists and as needed to provide the service. You may be
            able to delete individual activity from the product where the UI allows. If you ask to close your account,
            we will delete or anonymise personal data unless we must retain a limited set for legal, security, or
            accounting reasons.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-foreground">Security</h2>
          <p>
            We use industry-standard practices such as encryption in transit (HTTPS), access controls on servers, and
            separating user data in the database. No method of transmission or storage is perfectly secure; use a
            strong, unique password and protect your devices.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-foreground">Your rights</h2>
          <p>Depending on where you live, you may have rights to:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Access, correct, or delete your personal data.</li>
            <li>Restrict or object to certain processing.</li>
            <li>Data portability, where applicable.</li>
            <li>Withdraw consent where processing is consent-based.</li>
            <li>Lodge a complaint with a supervisory authority.</li>
          </ul>
          <p>
            To exercise these rights, contact us using the privacy contact above. We may need to verify your identity
            before acting on a request.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-foreground">Children</h2>
          <p>
            Recount is not directed at children under the age where parental consent is required in your region. If you
            believe we have collected data from a child inappropriately, contact us and we will take appropriate steps.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-foreground">Changes</h2>
          <p>
            We may update this policy when features or legal requirements change. We will adjust the “Last updated” date
            and, when appropriate, notify you by email or an in-app notice.
          </p>
        </section>

        <section className="space-y-3 border-t border-border pt-8">
          <p>
            <Link href="/" className="text-primary underline-offset-4 hover:underline">
              ← Back to home
            </Link>
          </p>
        </section>
      </article>
    </main>
  );
}
