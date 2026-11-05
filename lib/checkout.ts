// Checkout payload validation. Pure — takes the cart sent from the browser
// and the items looked up from the database, and either returns the line-item
// snapshot to charge or a Finnish error message the storefront can show.

export type CheckoutRequestItem = { id: string; quantity: number };

export type BuildableItem = {
  id: string;
  name: string;
  priceCents: number;
  stock: number | null;
  active: boolean;
};

export type ComputedLine = {
  itemId: string;
  name: string;
  priceCents: number;
  quantity: number;
};

export type BuildResult =
  | { ok: true; lines: ComputedLine[]; totalCents: number }
  | { ok: false; error: string };

const MAX_QUANTITY = 99;

export function buildCheckout(
  requested: CheckoutRequestItem[],
  items: BuildableItem[],
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
    lines.push({ itemId: item.id, name: item.name, priceCents: item.priceCents, quantity });
  }

  // The database is the source of truth for prices; the total is recomputed
  // here rather than trusting whatever the browser sent.
  const totalCents = lines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);
  return { ok: true, lines, totalCents };
}
