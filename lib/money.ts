// Money helpers. Prices are stored in cents everywhere in the database.
//
// These functions are dependency-free so the test suite can run them without
// touching Prisma.

/** Format cents as EUR the way a Finnish shop would: "16,00 €". */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(
    cents / 100,
  );
}

/**
 * Parse an admin-entered euro amount ("16,00", "16.00", "16 €") into cents.
 * Returns null when the input is not a finite, non-negative amount.
 */
export function parseEurosInput(input: string): number | null {
  const cleaned = input.trim().replace(/[€\s]/g, '').replace(',', '.');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}
