import { Anton } from "next/font/google";
import { RevealOnScroll } from "@/components/landing/reveal";
import { SiteFooter, SiteHeader } from "@/components/landing/site";

// display face for the public site only (see --font-display in globals.css)
const display = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton" });

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div className={`${display.variable} min-h-screen bg-white text-zinc-950`}>
      <RevealOnScroll />
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
