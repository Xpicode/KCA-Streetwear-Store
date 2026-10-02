import { Check, X } from "lucide-react";
import { Badge, ORDER_STATUS, PAYMENT_STATUS } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import { SocialIcon } from "@/components/social-icon";

export const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Manila" });

export const fmtDateTime = (d: Date | string) =>
  `${fmtDate(d)} · ${new Date(d).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" })}`;

export function OrderStatusBadge({ status }: { status: string }) {
  const s = ORDER_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function PaymentBadge({ status }: { status: string }) {
  const s = PAYMENT_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

/** Opens our Facebook page so the buyer can message us about the order. */
export function FacebookButton({ className }: { className?: string }) {
  return (
    <a
      href={BRAND.facebook}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#0866ff] px-3 text-sm font-bold text-white hover:bg-[#0756d6]", className)}
    >
      <SocialIcon name="Facebook" className="size-4" />
      Message us on Facebook
    </a>
  );
}

export const PAYMENT_METHOD: Record<string, string> = { cash: "Cash", bank: "Bank transfer", ewallet: "E-wallet" };

const STEPS: { key: string; label: string; hint: string }[] = [
  { key: "pending", label: "Requested", hint: "We're checking stock" },
  { key: "confirmed", label: "Confirmed", hint: "Stock set aside for you" },
  { key: "packed", label: "Packed", hint: "Awaiting your payment" },
  { key: "paid", label: "Paid", hint: "Payment received — shipping next" },
  { key: "delivered", label: "Delivered", hint: "All done" },
];

/** pending → confirmed → packed → delivered → paid, or a cancelled note. */
export function StatusTrack({
  status,
  dates,
}: {
  status: string;
  dates: { pending: Date; confirmed: Date | null; packed: Date | null; delivered: Date | null; paid: Date | null };
}) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
        <span className="flex size-7 items-center justify-center rounded-full bg-red-600 text-white">
          <X className="size-4" />
        </span>
        This order was cancelled. Message us if that was a mistake — you can also reorder below.
      </div>
    );
  }
  const current = Math.max(0, STEPS.findIndex((s) => s.key === status));
  return (
    <ol className="grid grid-cols-5 gap-1 sm:gap-2">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const at = dates[s.key as keyof typeof dates];
        return (
          <li key={s.key} className="relative flex flex-col items-center text-center">
            {i > 0 && <span className={cn("absolute top-3.5 right-1/2 left-[-50%] h-0.5", i <= current ? "bg-brand-600" : "bg-zinc-200")} />}
            <span
              className={cn(
                "relative z-10 flex size-7 items-center justify-center rounded-full text-xs font-extrabold ring-4",
                done && "bg-brand-600 text-white ring-white",
                active && "bg-brand-700 text-white ring-brand-100",
                !done && !active && "bg-zinc-200 text-zinc-500 ring-white"
              )}
            >
              {done ? <Check className="size-4" /> : i + 1}
            </span>
            <span className={cn("mt-2 text-[11px] font-bold sm:text-xs", active ? "text-zinc-900" : done ? "text-zinc-700" : "text-zinc-400")}>{s.label}</span>
            <span className="hidden text-[11px] font-medium text-zinc-500 sm:block">{at ? fmtDate(at) : active ? s.hint : ""}</span>
          </li>
        );
      })}
    </ol>
  );
}
