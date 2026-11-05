import { describe, expect, it } from 'vitest';
import { applyQuantityToStock } from '@/lib/orders';

describe('applyQuantityToStock', () => {
  it('decrements finite stocks and floors at zero', () => {
    expect(applyQuantityToStock([{ itemId: 'a', stock: 5, quantity: 2 }])).toEqual([
      { itemId: 'a', newStock: 3 },
    ]);
    expect(applyQuantityToStock([{ itemId: 'a', stock: 2, quantity: 5 }])).toEqual([
      { itemId: 'a', newStock: 0 },
    ]);
  });

  it('leaves unlimited (null) items untouched', () => {
    expect(applyQuantityToStock([{ itemId: 'b', stock: null, quantity: 9 }])).toEqual([
      { itemId: 'b', newStock: null },
    ]);
  });

  it('handles several lines at once', () => {
    expect(
      applyQuantityToStock([
        { itemId: 'a', stock: 10, quantity: 3 },
        { itemId: 'b', stock: null, quantity: 2 },
        { itemId: 'c', stock: 1, quantity: 5 },
      ]),
    ).toEqual([
      { itemId: 'a', newStock: 7 },
      { itemId: 'b', newStock: null },
      { itemId: 'c', newStock: 0 },
    ]);
  });
});
