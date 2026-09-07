import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-zinc-100 text-zinc-700",
  green: "bg-brand-50 text-brand-700",
  solid: "bg-brand-700 text-white",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  blue: "bg-blue-50 text-blue-700",
  indigo: "bg-indigo-50 text-indigo-700",
} as const;

export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold", tones[tone], className)}>
      {children}
    </span>
  );
}

/** Order status → badge tone + human label, shared by admin and shop. */
export const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "amber" },
  confirmed: { label: "Confirmed", tone: "indigo" },
  packed: { label: "Packed", tone: "blue" },
  paid: { label: "Paid", tone: "green" },
  delivered: { label: "Delivered", tone: "solid" },
  cancelled: { label: "Cancelled", tone: "red" },
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  unpaid: { label: "Unpaid", tone: "red" },
  partial: { label: "Partial", tone: "amber" },
  paid: { label: "Paid", tone: "green" },
};
