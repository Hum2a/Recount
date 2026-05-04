import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  try {
    const res = await updateSession(request);
    // Avoid edge/browser holding **stale HTML** that references old `_next/static` chunk hashes
    // after a new deploy (mismatch → 404 on chunks, MIME type text/html).
    res.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    return res;
  } catch {
    // Avoid returning an HTML error document for asset URLs if session refresh fails.
    return NextResponse.next();
  }
}

/** Skip all of `/_next/*` (static, image optimizer, HMR) plus common static files. */
export const config = {
  matcher: ["/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
