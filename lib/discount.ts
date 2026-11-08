// Discount codes. Pure helpers shared by the checkout route (authoritative)
// and the cart preview (client). A code is a percentage off; `leaderOnly`
// restricts it to lines whose item opted into the leaders' discount.

export type DiscountCodeLike = {
  code: string;
  percentOff: number;
  leaderOnly: boolean;
};

/** Normalise a typed code for lookup/compare: trimmed, uppercased. */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/** True when this code may discount a line (unrestricted, or a leader line). */
export function discountApplies(
  discount: Pick<DiscountCodeLike, 'leaderOnly'>,
  line: { leaderDiscount?: boolean },
): boolean {
  return !discount.leaderOnly || line.leaderDiscount === true;
}

/** Discounted unit price in cents, rounded. Clamped to a sane 1..100 %. */
export function discountedUnitCents(priceCents: number, percentOff: number): number {
  const pct = Math.min(100, Math.max(0, percentOff));
  return Math.round((priceCents * (100 - pct)) / 100);
}

/** Short label appended to a discounted line, e.g. "JOHTAJA −50 %". */
export function discountLabel(code: string, percentOff: number): string {
  return `${code} −${percentOff} %`;
}
