import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Block, PageHero, SectionBar, container, label, navLink } from "@/components/landing/site";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Contact",
  description: "Message KCA Streetwear about wholesale orders, retail purchases, custom prints or an existing order.",
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Message us. Any time."
        intro="Orders come in around the clock through the store. For questions, bulk quotes, custom prints or help with an order, reach us here."
      />

      <section className="border-b border-zinc-950">
        <div className={`${container} grid gap-px border-b border-zinc-950 md:grid-cols-3`}>
          <Card title="Mobile" value={BRAND.phone} note="Call, text, Viber or WhatsApp" />
          <Card title="Email" value={BRAND.email} note="Quotes and custom print inquiries" />
          <Card title="Location" value={BRAND.city} note="Pickup by appointment" last />
        </div>
      </section>

      <section className="border-b border-zinc-950">
        <div className={`${container} pb-16`}>
          <SectionBar no="01" title="What to send us" />
          <Block n="1" title="About an order you already placed">
            <p>Send the order number and the mobile number used at checkout. You can also check its status yourself any time.</p>
            <Link href="/shop/orders" className={`mt-2 inline-flex items-center gap-1 underline-offset-4 hover:underline ${navLink}`}>
              Track an order <ArrowUpRight className="size-4" />
            </Link>
          </Block>
          <Block n="2" title="Bulk quotes" bullets={["Style or category", "Estimated pieces per style", "Sizes and colors you need", "Delivery address"]}>
            <p>For quantities beyond the tiers shown on the product page, message us with the details below and we send a quote.</p>
          </Block>
          <Block n="3" title="Custom prints and branding">
            <p>We can print or embroider your own design on our blanks. Send the artwork, the style, the quantity and your deadline.</p>
          </Block>
          <Block n="4" title="Becoming a regular buyer">
            <p>Shops that reorder with us can be moved to better pricing. Tell us your shop name and we set it up on your account.</p>
          </Block>
        </div>
      </section>
    </>
  );
}

function Card({ title, value, note, last }: { title: string; value: string; note: string; last?: boolean }) {
  return (
    <div className={`reveal py-10 md:px-8 ${last ? "" : "border-b border-zinc-950 md:border-r md:border-b-0"} md:first:pl-0`}>
      <div className={label}>{title}</div>
      <div className="mt-3 font-display text-2xl leading-none break-words sm:text-3xl">{value}</div>
      <div className="mt-3 text-sm font-medium text-zinc-500">{note}</div>
    </div>
  );
}
