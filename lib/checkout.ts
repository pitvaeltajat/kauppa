// Checkout payload validation. Pure — takes the cart sent from the browser
// and the items looked up from the database, and either returns the line-item
// snapshot to charge or a Finnish error message the storefront can show.

import {
  type DiscountCodeLike,
  discountApplies,
  discountedUnitCents,
  discountLabel,
} from '@/lib/discount';

export type CheckoutRequestItem = { id: string; quantity: number };

export type BuildableItem = {
  id: string;
  name: string;
  priceCents: number;
  stock: number | null;
  active: boolean;
  /** Event opted into the leaders' discount (ignored by non-leader codes). */
  leaderDiscount?: boolean;
};

export type ComputedLine = {
  itemId: string;
  name: string;
  priceCents: number;
  quantity: number;
};

export type BuildResult =
  | {
      ok: true;
      lines: ComputedLine[];
      totalCents: number;
      /** Cents saved by the discount, 0 when none applied. */
      discountCents: number;
      /** The code that actually discounted a line, else null. */
      appliedCode: string | null;
    }
  | { ok: false; error: string };

const MAX_QUANTITY = 99;

export function buildCheckout(
  requested: CheckoutRequestItem[],
  items: BuildableItem[],
  discount?: DiscountCodeLike | null,
): BuildResult {
  // Collapse duplicate ids and drop invalid quantities.
  const wanted = new Map<string, number>();
  for (const r of requested) {
    const quantity = Math.trunc(r.quantity);
    if (!Number.isFinite(quantity) || quantity < 1) continue;
    if (quantity > MAX_QUANTITY) {
      return { ok: false, error: 'Yhden tuotteen määrä saa olla enintään 99.' };
    }
    wanted.set(r.id, (wanted.get(r.id) ?? 0) + quantity);
  }
  if (wanted.size === 0) {
    return { ok: false, error: 'Ostoskori on tyhjä.' };
  }

  const byId = new Map(items.map((i) => [i.id, i]));
  const lines: ComputedLine[] = [];
  let discountCents = 0;
  let appliedCode: string | null = null;
  for (const [id, quantity] of wanted) {
    const item = byId.get(id);
    if (!item) {
      return { ok: false, error: 'Osa tuotteista ei ole enää myynnissä.' };
    }
    if (!item.active) {
      return { ok: false, error: `"${item.name}" ei ole enää myynnissä.` };
    }
    if (item.stock !== null && item.stock < quantity) {
      return {
        ok: false,
        error: `"${item.name}" on loppunut varastosta (jäljellä ${item.stock} kpl).`,
      };
    }

    // Apply the discount per unit so Stripe line items and the order snapshot
    // stay in integer cents. A leaderOnly code skips lines that didn't opt in.
    let priceCents = item.priceCents;
    let name = item.name;
    if (discount && discount.percentOff > 0 && discountApplies(discount, item)) {
      const discounted = discountedUnitCents(item.priceCents, discount.percentOff);
      if (discounted < item.priceCents) {
        discountCents += (item.priceCents - discounted) * quantity;
        appliedCode = discount.code;
        priceCents = discounted;
        name = `${item.name} (${discountLabel(discount.code, discount.percentOff)})`;
      }
    }
    lines.push({ itemId: item.id, name, priceCents, quantity });
  }

  // The database is the source of truth for prices; the total is recomputed
  // here rather than trusting whatever the browser sent.
  const totalCents = lines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);
  return { ok: true, lines, totalCents, discountCents, appliedCode };
}
