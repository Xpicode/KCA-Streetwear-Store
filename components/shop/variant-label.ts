/** Pure helpers for naming variants — usable from client components. */

export function variantLabel(v: { size: string | null; color: string | null }) {
  return [v.color, v.size].filter(Boolean).join(" · ") || "Standard";
}

/** Summarise the option set of a product: "5 sizes · 4 colors" / "5 colors" / "One size". */
export function variantSummary(variants: { size: string | null; color: string | null }[]) {
  const sizes = new Set(variants.map((v) => v.size).filter(Boolean));
  const colors = new Set(variants.map((v) => v.color).filter(Boolean));
  const parts = [
    sizes.size > 1 ? `${sizes.size} sizes` : null,
    colors.size > 1 ? `${colors.size} colors` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "One size";
}
