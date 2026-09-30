import { Badge, ORDER_STATUS, PAYMENT_STATUS, type Tone } from "@/components/ui/badge";

/** Small shared pieces for the order / customer / report pages. */

export function StatusBadge({ status }: { status: string }) {
  const s = ORDER_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function PaymentBadge({ status }: { status: string }) {
  const s = PAYMENT_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export const CUSTOMER_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  blocked: { label: "Blocked", tone: "red" },
};

export function CustomerStatusBadge({ status }: { status: string }) {
  const s = CUSTOMER_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = new Date(d);
  return `${date.toLocaleDateString("en-PH", { day: "numeric", month: "short" })} · ${date.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export const SOURCE_LABEL: Record<string, string> = { storefront: "Wholesale shop", retail: "Retail store", manual: "Manual" };

export function sourceLabel(source: string) {
  return SOURCE_LABEL[source] ?? source;
}

/** Peso with centavos for line-level figures (lib/format peso() rounds to whole pesos). */
export function pesoExact(n: number) {
  return "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
