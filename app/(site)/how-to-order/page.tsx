import type { Metadata } from "next";
import Link from "next/link";
import { Block, Cta, PageHero, SectionBar, container } from "@/components/landing/site";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "How to order",
  description: "How wholesale and retail orders work at KCA Streetwear: browse live stock, send a request, pay by GCash, Maya or bank transfer.",
};

export default function HowToOrderPage() {
  return (
    <>
      <PageHero
        eyebrow="How to order"
        title="No account. No forms. Just send it."
        intro="Both stores work the same way: you build an order from live stock, send it as a request, and we confirm it with you by message before anything is paid or shipped."
      />

      <section className="border-b border-zinc-950">
        <div className={`${container} pb-16`}>
          <SectionBar no="01" title="Step by step" />
          <Block n="1" title="Browse live stock">
            <p>
              Every product shows what is actually on the shelf per size and color, so you never order something we cannot send.
              Wholesale buyers see per-piece prices and quantity tiers; retail buyers see one flat price per piece.
            </p>
          </Block>
          <Block n="2" title="Build your order">
            <p>
              Pick sizes and colors and add them to the cart. In the wholesale store every style has a minimum quantity; sizes and
              colors of the same style count together, so you can mix freely and still reach the tier price. In the retail store
              you can buy a single piece.
            </p>
          </Block>
          <Block n="3" title="Send the order request" bullets={["Shop name and contact person (wholesale) or just your name (retail)", "Mobile number we can message", "Delivery address"]}>
            <p>Checkout asks for three things and nothing else. No sign-up, no password, no payment yet.</p>
          </Block>
          <Block n="4" title="We confirm">
            <p>
              We check the stock, add shipping if needed and message you the final total. If something changed in the meantime
              we tell you before you pay. You get an order number right away and can follow the order under &ldquo;My orders&rdquo;.
            </p>
          </Block>
          <Block n="5" title="Pay" bullets={["GCash", "Maya", "Bank transfer"]}>
            <p>Pay the confirmed total by any of these and send us the reference or a screenshot. We mark the order paid as soon as it lands.</p>
          </Block>
          <Block n="6" title="We pack and ship">
            <p>
              Paid orders are packed from the stock we reserved for you and handed to the courier the same day. Pickup in{" "}
              {BRAND.city} can be arranged when you confirm.
            </p>
          </Block>
        </div>
      </section>

      <section className="border-b border-zinc-950">
        <div className={`${container} pb-16`}>
          <SectionBar no="02" title="Good to know" />
          <Block n="7" title="Changing or cancelling">
            <p>
              Until the order is confirmed you can simply send a new request. After confirmation, message us and we adjust it
              before it is packed. Unpaid orders that are not settled are released so the stock goes back on sale.
            </p>
          </Block>
          <Block n="8" title="Reordering">
            <p>
              Open any past order under &ldquo;My orders&rdquo; and press reorder. The same sizes and colors are put back in your cart with
              current stock and prices.
            </p>
          </Block>
          <Block n="9" title="Tracking an order from another phone">
            <p>
              Orders are remembered on the device that placed them. From anywhere else, open{" "}
              <Link href="/shop/orders" className="underline underline-offset-4">Track order</Link> and enter the order number and the
              mobile number used at checkout.
            </p>
          </Block>
          <Block n="10" title="Defects and exchanges">
            <p>Message us with a photo within 7 days of receiving the parcel and we replace or credit the piece.</p>
          </Block>
        </div>
      </section>

      <Cta title="Ready when you are." text="Pick a store and build your first order. We confirm by message and ship the same day after payment." />
    </>
  );
}
