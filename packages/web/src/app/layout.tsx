import type { Metadata } from "next";
import { Suspense } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { SessionProvider } from "@/components/providers/session-provider";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { SiteVersionFooter } from "@/components/layout/site-version-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recount — Honest productivity",
  description: "Passive tab tracking with morning intentions and AI accountability reports.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${GeistSans.className} ${GeistMono.variable} flex min-h-screen flex-col bg-background bg-mesh text-foreground`}
      >
        <SessionProvider>
          <Suspense fallback={null}>
            <NavigationProgress />
          </Suspense>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1">{children}</div>
            <SiteVersionFooter />
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
