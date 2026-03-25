import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { AppMark } from "@/components/brand/app-mark";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";

type Props = {
  user: User | null;
  /** e.g. `/login?next=%2Fpricing` when the page should return here after sign-in */
  loginHref?: string;
  /** Set false on `/pricing` so the nav does not link to the current page */
  showPricingNav?: boolean;
};

export function MarketingHeader({ user, loginHref = "/login", showPricingNav = true }: Props) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <AppMark href="/" />
      {user ? (
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost">Dashboard</Button>
          </Link>
          <SignOutButton />
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {showPricingNav ? (
            <Link href="/pricing">
              <Button variant="ghost">Pricing</Button>
            </Link>
          ) : null}
          <Link href={loginHref}>
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link href="/signup">
            <Button>Get started</Button>
          </Link>
        </div>
      )}
    </header>
  );
}
