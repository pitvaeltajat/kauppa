// Checkout payload validation. Pure: takes the cart sent from the browser
// and the items looked up from the database, and either returns the line-item
// snapshot to charge or a Finnish error message the storefront can show.

import {
  type DiscountCodeLike,
  discountApplies,
  discountedUnitCents,
  discountLabel,
} from '@/lib/discount';

export type CheckoutRequestItem = { id: string; quantity: number; variantId?: string };

export type BuildableItem = {
  id: string;
  name: string;
  priceCents: number;
  stock: number | null;
  active: boolean;
  /** Event opted into the leaders' discount (ignored by non-leader codes). */
  leaderDiscount?: boolean;
  variants?: { id: string; name: string; priceCents: number; active: boolean }[];
};

export type ComputedLine = {
  itemId: string;
  variantId: string | null;
  variantName: string | null;
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
  const wanted = new Map<string, { id: string; variantId?: string; quantity: number }>();
  for (const r of requested) {
    const quantity = Math.trunc(r.quantity);
    if (!Number.isFinite(quantity) || quantity < 1) continue;
    if (quantity > MAX_QUANTITY) {
      return { ok: false, error: 'Yhtä tuotetta voi olla korissa enintään 99 kappaletta.' };
    }
    const key = `${r.id}:${r.variantId ?? ''}`;
    const previous = wanted.get(key);
    wanted.set(key, {
      id: r.id,
      variantId: r.variantId,
      quantity: (previous?.quantity ?? 0) + quantity,
    });
  }
  if (wanted.size === 0) {
    return { ok: false, error: 'Ostoskori on tyhjä.' };
  }

  const byId = new Map(items.map((i) => [i.id, i]));
  const lines: ComputedLine[] = [];
  let discountCents = 0;
  let appliedCode: string | null = null;
  for (const { id, variantId, quantity } of wanted.values()) {
    const item = byId.get(id);
    if (!item) {
      return { ok: false, error: 'Jokin tuotteista ei ole enää myynnissä.' };
    }
    if (!item.active) {
      return { ok: false, error: `"${item.name}" ei ole enää myynnissä.` };
    }
    if (item.stock !== null && item.stock < quantity) {
      return {
        ok: false,
        error: `Tuote "${item.name}" on loppunut varastosta tässä määrässä (jäljellä ${item.stock} kpl).`,
      };
    }

    const variants = item.variants ?? [];
    if (variants.length > 0 && !variantId) {
      return { ok: false, error: `Valitse tuotteelle "${item.name}" vaihtoehto.` };
    }
    if (variantId && variants.length === 0) {
      return { ok: false, error: `Tuotteen "${item.name}" vaihtoehto ei ole käytettävissä.` };
    }
    const variant = variantId ? variants.find((candidate) => candidate.id === variantId) : null;
    if (variantId && (!variant || !variant.active)) {
      return {
        ok: false,
        error: `Valittu vaihtoehto tuotteelle "${item.name}" ei ole saatavilla.`,
      };
    }

    // Apply the discount per unit so Stripe line items and the order snapshot
    // stay in integer cents. A leaderOnly code skips lines that didn't opt in.
    const basePriceCents = variant?.priceCents ?? item.priceCents;
    let priceCents = basePriceCents;
    const variantName = variant?.name ?? null;
    let name = variantName ? `${item.name} - ${variantName}` : item.name;
    if (discount && discount.percentOff > 0 && discountApplies(discount, item)) {
      const discounted = discountedUnitCents(basePriceCents, discount.percentOff);
      if (discounted < basePriceCents) {
        discountCents += (basePriceCents - discounted) * quantity;
        appliedCode = discount.code;
        priceCents = discounted;
        name = `${item.name} (${discountLabel(discount.code, discount.percentOff)})`;
        if (variantName)
          name = `${item.name} - ${variantName} (${discountLabel(discount.code, discount.percentOff)})`;
      }
    }
    lines.push({
      itemId: item.id,
      variantId: variant?.id ?? null,
      variantName,
      name,
      priceCents,
      quantity,
    });
  }

  // The database is the source of truth for prices; the total is recomputed
  // here rather than trusting whatever the browser sent.
  const totalCents = lines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);
  return { ok: true, lines, totalCents, discountCents, appliedCode };
}
