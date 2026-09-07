/** Preferred-payment choices on the checkout form. Stored as text in the order note. Payment is made after we confirm — delivery follows payment. */
export const PAYMENT_OPTIONS = [
  { value: "gcash", label: "GCash", hint: "We send the number after confirming" },
  { value: "maya", label: "Maya", hint: "We send the number after confirming" },
  { value: "bank", label: "Bank transfer", hint: "We send bank details after confirming" },
] as const;

export type PaymentValue = (typeof PAYMENT_OPTIONS)[number]["value"];
