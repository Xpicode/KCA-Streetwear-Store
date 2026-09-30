import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { ThemeScript } from "@/components/theme-script";

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
        <ThemeScript nonce={nonce} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
