import type { Metadata } from "next";
import { Block, Cta, PageHero, SectionBar, container, label } from "@/components/landing/site";
import { getLandingData } from "@/lib/queries/landing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing",
  description: "How wholesale tiers, minimum quantities and retail prices work at KCA Streetwear.",
};

export default async function PricingPage() {
  const { stats } = await getLandingData();
  const moq = stats.minMoq;

  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Buy more, pay less per piece."
        intro="Wholesale prices drop in tiers as the quantity of a style goes up. Retail buyers pay one flat price per piece with no minimum. Everything is shown per piece, before shipping, and confirmed with you before you pay."
      />

      <section className="border-b border-zinc-950">
        <div className={`${container} pb-16`}>
          <SectionBar no="01" title="Wholesale" />
          <Block n="1" title="Minimum per style">
            <p>
              The wholesale store has a minimum quantity per style, currently {moq} pcs for most styles. The minimum is per style,
              not per size or color: 4 small, 4 medium and 4 large of the same tee count as 12.
            </p>
          </Block>
          <Block n="2" title="Quantity tiers">
            <p>
              Each style has its own tiers. The more pieces of that style in the order, the lower the per-piece price. Tiers are
              shown on the product page and the cart applies the best one automatically as you change quantities.
            </p>
          </Block>
          <Block n="3" title="Regular buyer pricing">
            <p>
              Shops that order with us regularly can be placed on a better price group. Your prices then show automatically when you
              order from the device you have used before. Ask us after your first few orders.
            </p>
          </Block>
          <div className="reveal mt-10 max-w-xl">
            <div className={label}>Example · Plain cotton tee</div>
            <table className="mt-4 w-full border-t border-zinc-950 font-mono text-sm">
              <tbody>
                <Row qty="1 – 11 pcs" price="₱150" note="retail store" />
                <Row qty="12 – 47 pcs" price="₱140" note="wholesale, first tier" />
                <Row qty="48+ pcs" price="₱130" note="wholesale, volume tier" best />
              </tbody>
            </table>
            <p className="mt-3 text-sm font-medium text-zinc-500">Illustrative. Live prices are on each product page.</p>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-950">
        <div className={`${container} pb-16`}>
          <SectionBar no="02" title="Retail" />
          <Block n="4" title="One price, no minimum">
            <p>
              The retail store sells the same products from the same stock at a per-piece retail price. Buy one piece or ten; the
              price does not change with quantity.
            </p>
          </Block>
        </div>
      </section>

      <section className="border-b border-zinc-950">
        <div className={`${container} pb-16`}>
          <SectionBar no="03" title="Shipping and payment" />
          <Block n="5" title="Shipping">
            <p>
              Prices do not include shipping. We quote the courier fee with your confirmed total based on the parcel size and your
              address. Pickup can be arranged instead.
            </p>
          </Block>
          <Block n="6" title="Payment" bullets={["GCash", "Maya", "Bank transfer"]}>
            <p>No online card payment and no deposit at checkout. You pay the confirmed total after we message you, and the order ships once it is received.</p>
          </Block>
          <Block n="7" title="No surprises">
            <p>The total we confirm is the total you pay. If stock or pricing changes between your request and confirmation, we tell you first.</p>
          </Block>
        </div>
      </section>

      <Cta title="See live prices." text="Every product page shows its tiers and the current stock per size and color." />
    </>
  );
}

function Row({ qty, price, note, best }: { qty: string; price: string; note: string; best?: boolean }) {
  return (
    <tr className="border-b border-zinc-200">
      <td className="py-4 pr-4">
        <div className={best ? "font-bold" : ""}>{qty}</div>
        <div className="text-xs text-zinc-500">{note}</div>
      </td>
      <td className="py-4 text-right">
        <span className="font-display text-2xl">{price}</span>
        <span className="ml-1 text-xs text-zinc-500">/pc</span>
        {best ? <span className="ml-3 bg-zinc-950 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">best</span> : null}
      </td>
    </tr>
  );
}
