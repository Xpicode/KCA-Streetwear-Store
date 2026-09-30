/**
 * The storefront runs in two modes on the same catalog, stock and order pipeline:
 *
 *   wholesale  /shop     wholesale price, per-style minimum qty, quantity tiers, price groups
 *   retail     /retail   flat retail price per product (products.retail_price), buy 1 or more
 *
 * Pure constants — safe to import from client components.
 */
export type Channel = "wholesale" | "retail";

export type ChannelInfo = {
  key: Channel;
  /** first URL segment */
  slug: string;
  /** "/shop" or "/retail" — prefix for every storefront link */
  base: string;
  label: string;
  cartCookie: string;
  shopperCookie: string;
  /** stored on orders.source */
  source: "storefront" | "retail";
};

export const CHANNELS: Record<Channel, ChannelInfo> = {
  wholesale: {
    key: "wholesale",
    slug: "shop",
    base: "/shop",
    label: "Wholesale",
    cartCookie: "ws_cart",
    shopperCookie: "ws_shopper",
    source: "storefront",
  },
  retail: {
    key: "retail",
    slug: "retail",
    base: "/retail",
    label: "Retail",
    cartCookie: "ws_cart_retail",
    shopperCookie: "ws_shopper_retail",
    source: "retail",
  },
};

export const CHANNEL_KEYS = Object.keys(CHANNELS) as Channel[];

export function isChannel(value: unknown): value is Channel {
  return typeof value === "string" && value in CHANNELS;
}

/** URL segment ("shop" | "retail") → channel, or null for anything else. */
export function channelFromSlug(slug: string): ChannelInfo | null {
  return CHANNEL_KEYS.map((k) => CHANNELS[k]).find((c) => c.slug === slug) ?? null;
}

/** The other storefront, for the "switch to …" link in the header. */
export function otherChannel(channel: Channel): ChannelInfo {
  return CHANNELS[channel === "retail" ? "wholesale" : "retail"];
}
