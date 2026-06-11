import type { Metadata } from "next";
import type React from "react";
import "./globals.css";
import { AppShell } from "@/components/modules/app-shell";
import { Providers } from "@/components/modules/providers";

export const metadata: Metadata = {
  title: "Mission Control | THEVETERINARIAN.AI",
  description: "Founder operating system for THEVETERINARIAN.AI.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
