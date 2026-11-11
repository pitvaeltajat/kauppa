import { describe, expect, it } from 'vitest';
import { buildCheckout, type BuildableItem } from '@/lib/checkout';

const pipo: BuildableItem = {
  id: 'a',
  name: 'PitVa-pipo',
  priceCents: 1600,
  stock: 5,
  active: true,
};
const unlimited: BuildableItem = {
  id: 'b',
  name: 'Setin hinta',
  priceCents: 1200,
  stock: null,
  active: true,
};
const hidden: BuildableItem = { ...pipo, id: 'c', name: 'Hylätty', active: false };

describe('buildCheckout', () => {
  it('computes line items and total from the database prices', () => {
    const result = buildCheckout(
      [
        { id: 'a', quantity: 2 },
        { id: 'b', quantity: 1 },
      ],
      [pipo, unlimited],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines).toEqual([
      {
        itemId: 'a',
        variantId: null,
        variantName: null,
        name: 'PitVa-pipo',
        priceCents: 1600,
        quantity: 2,
      },
      {
        itemId: 'b',
        variantId: null,
        variantName: null,
        name: 'Setin hinta',
        priceCents: 1200,
        quantity: 1,
      },
    ]);
    expect(result.totalCents).toBe(4400);
  });

  it('collapses duplicate ids and drops invalid quantities', () => {
    const result = buildCheckout(
      [
        { id: 'a', quantity: 1 },
        { id: 'a', quantity: 2 },
        { id: 'b', quantity: -4 },
      ],
      [pipo, unlimited],
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lines).toEqual([
        {
          itemId: 'a',
          variantId: null,
          variantName: null,
          name: 'PitVa-pipo',
          priceCents: 1600,
          quantity: 3,
        },
      ]);
      expect(result.totalCents).toBe(4800);
    }
  });

  it('rejects an empty cart', () => {
    const result = buildCheckout([], [pipo]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('tyhjä');
  });

  it('rejects quantities over the cap', () => {
    const result = buildCheckout([{ id: 'a', quantity: 100 }], [pipo]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('99');
  });

  it('rejects unknown and inactive items', () => {
    expect(buildCheckout([{ id: 'zzz', quantity: 1 }], [pipo]).ok).toBe(false);
    const inactive = buildCheckout([{ id: 'c', quantity: 1 }], [pipo, hidden]);
    expect(inactive.ok).toBe(false);
    if (!inactive.ok) expect(inactive.error).toContain('ei ole enää myynnissä');
  });

  it('rejects when stock is insufficient', () => {
    const result = buildCheckout([{ id: 'a', quantity: 6 }], [pipo]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('loppunut');
  });

  it('allows unlimited stock items in any quantity', () => {
    const result = buildCheckout([{ id: 'b', quantity: 50 }], [unlimited]);
    expect(result.ok).toBe(true);
  });

  it('uses the selected variant price and snapshots its name', () => {
    const item: BuildableItem = {
      ...pipo,
      variants: [
        { id: 'short', name: 'Lyhyt leiri', priceCents: 2500, active: true },
        { id: 'long', name: 'Pitkä leiri', priceCents: 4000, active: true },
      ],
    };
    const result = buildCheckout([{ id: 'a', variantId: 'long', quantity: 2 }], [item]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines).toEqual([
      {
        itemId: 'a',
        variantId: 'long',
        variantName: 'Pitkä leiri',
        name: 'PitVa-pipo - Pitkä leiri',
        priceCents: 4000,
        quantity: 2,
      },
    ]);
    expect(result.totalCents).toBe(8000);
  });

  it('requires a valid variant when an item has variants', () => {
    const item: BuildableItem = {
      ...pipo,
      variants: [{ id: 'short', name: 'Lyhyt leiri', priceCents: 2500, active: true }],
    };
    expect(buildCheckout([{ id: 'a', quantity: 1 }], [item]).ok).toBe(false);
    expect(buildCheckout([{ id: 'a', variantId: 'missing', quantity: 1 }], [item]).ok).toBe(false);
  });
});
