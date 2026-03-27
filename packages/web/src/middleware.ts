import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  try {
    return await updateSession(request);
  } catch {
    // Avoid returning an HTML error document for asset URLs if session refresh fails.
    return NextResponse.next();
  }
}

/** Skip all of `/_next/*` (static, image optimizer, HMR) plus common static files. */
export const config = {
  matcher: ["/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
