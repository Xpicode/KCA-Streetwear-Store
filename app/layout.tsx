import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { Suspense } from "react";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "KCA Streetwear Wholesale", template: "%s · KCA Streetwear" },
  description: "Streetwear tees, caps and accessories at wholesale prices for resellers.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // per-request CSP nonce from proxy.ts; the inline theme script must carry it to run
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* sets the .dark class before paint — see lib/theme.ts. A plain inline tag is the only
            thing that runs before first paint (next/script beforeInteractive waits for Next's JS). */}
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {/* Suspense keeps page errors out of the document shell: the shell (with the theme
            script) is always server-rendered, and a failing page falls to app/error.tsx. */}
        <Suspense>{children}</Suspense>
      </body>
    </html>
  );
}
