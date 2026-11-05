// Stock decrement logic, separated from the webhook handler so it can be
// tested without a database. stock === null means unlimited (bundles, event
// registrations), and stays null.

export type StockSpend = { itemId: string; stock: number | null; quantity: number };

export type StockResult = { itemId: string; newStock: number | null };

export function applyQuantityToStock(spends: StockSpend[]): StockResult[] {
  return spends.map(({ itemId, stock, quantity }) => ({
    itemId,
    newStock: stock === null ? null : Math.max(0, stock - quantity),
  }));
}
