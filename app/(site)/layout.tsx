import { Anton } from "next/font/google";
import { RevealOnScroll } from "@/components/landing/reveal";
import { SiteFooter, SiteHeader } from "@/components/landing/site";
import { Splash } from "@/components/landing/splash";

// display face for the public site only (see --font-display in globals.css)
const display = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton" });

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div className={`${display.variable} min-h-screen bg-white text-zinc-950`}>
      <Splash />
      <RevealOnScroll />
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
