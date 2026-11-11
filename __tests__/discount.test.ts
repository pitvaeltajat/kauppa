import { describe, expect, it } from 'vitest';
import { buildCheckout, type BuildableItem } from '@/lib/checkout';
import {
  discountedUnitCents,
  discountApplies,
  LEADER_DISCOUNT_CODE,
  LEADER_DISCOUNT_PERCENT,
  normalizeCode,
} from '@/lib/discount';

const leaderEvent: BuildableItem = {
  id: 'e1',
  name: 'Johtajistoretki',
  stock: null,
  active: true,
  leaderDiscount: true,
  variants: [{ id: 'e1-default', name: null, priceCents: 2500, active: true }],
};
const plainEvent: BuildableItem = {
  id: 'e2',
  name: 'Perheretki',
  stock: null,
  active: true,
  leaderDiscount: false,
  variants: [{ id: 'e2-default', name: null, priceCents: 1500, active: true }],
};

const JOHTAJA = { code: 'JOHTAJA', percentOff: 50, leaderOnly: true };

describe('discount helpers', () => {
  it('keeps the leaders discount defaults fixed', () => {
    expect(LEADER_DISCOUNT_CODE).toBe('JOHTAJA');
    expect(LEADER_DISCOUNT_PERCENT).toBe(50);
  });

  it('rounds the discounted unit price and clamps the percent', () => {
    expect(discountedUnitCents(2500, 50)).toBe(1250);
    expect(discountedUnitCents(999, 50)).toBe(500); // 499.5 → 500
    expect(discountedUnitCents(1600, 0)).toBe(1600);
    expect(discountedUnitCents(1600, 150)).toBe(0);
  });

  it('leaderOnly applies only to opted-in lines', () => {
    expect(discountApplies(JOHTAJA, { leaderDiscount: true })).toBe(true);
    expect(discountApplies(JOHTAJA, { leaderDiscount: false })).toBe(false);
    expect(discountApplies({ leaderOnly: false }, { leaderDiscount: false })).toBe(true);
  });

  it('normalizes typed codes', () => {
    expect(normalizeCode('  johtaja ')).toBe('JOHTAJA');
  });
});

describe('buildCheckout with a discount', () => {
  it('discounts only the leader-enabled line for JOHTAJA', () => {
    const result = buildCheckout(
      [
        { id: 'e1', quantity: 1 },
        { id: 'e2', quantity: 1 },
      ],
      [leaderEvent, plainEvent],
      JOHTAJA,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const leaderLine = result.lines.find((l) => l.itemId === 'e1')!;
    const plainLine = result.lines.find((l) => l.itemId === 'e2')!;
    expect(leaderLine.priceCents).toBe(1250);
    expect(leaderLine.name).toContain('JOHTAJA');
    expect(plainLine.priceCents).toBe(1500); // untouched
    expect(result.discountCents).toBe(1250);
    expect(result.appliedCode).toBe('JOHTAJA');
    expect(result.totalCents).toBe(1250 + 1500);
  });

  it('applies the saving per unit across the quantity', () => {
    const result = buildCheckout([{ id: 'e1', quantity: 3 }], [leaderEvent], JOHTAJA);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totalCents).toBe(1250 * 3);
    expect(result.discountCents).toBe(1250 * 3);
  });

  it('a whole-cart code discounts every line', () => {
    const result = buildCheckout([{ id: 'e2', quantity: 2 }], [plainEvent], {
      code: 'KESA10',
      percentOff: 10,
      leaderOnly: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines[0].priceCents).toBe(1350);
    expect(result.appliedCode).toBe('KESA10');
  });

  it('leaves appliedCode null when a leaderOnly code matches nothing', () => {
    const result = buildCheckout([{ id: 'e2', quantity: 1 }], [plainEvent], JOHTAJA);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.discountCents).toBe(0);
    expect(result.appliedCode).toBe(null);
    expect(result.lines[0].priceCents).toBe(1500);
  });

  it('no discount leaves prices and totals unchanged', () => {
    const result = buildCheckout([{ id: 'e1', quantity: 1 }], [leaderEvent]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totalCents).toBe(2500);
    expect(result.discountCents).toBe(0);
    expect(result.appliedCode).toBe(null);
  });
});
