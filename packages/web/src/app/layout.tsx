import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recount — Honest productivity",
  description: "Passive tab tracking with morning intentions and AI accountability reports.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${GeistSans.className} ${GeistMono.variable} min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
