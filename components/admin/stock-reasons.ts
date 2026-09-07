/** Reasons for a manual stock adjustment. Shared by the server action and the inline form. */
export const ADJUST_REASONS = ["damaged", "lost", "count", "return", "other"] as const;
export type AdjustReason = (typeof ADJUST_REASONS)[number];

export const REASON_LABEL: Record<AdjustReason, string> = {
  damaged: "Damaged",
  lost: "Lost",
  count: "Stock count",
  return: "Customer return",
  other: "Other",
};
