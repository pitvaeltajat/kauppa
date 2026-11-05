import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Fresh catalog rows for the cart. The cart only stores ids and quantities, so
 * the cart page always re-reads names, prices and stock from the database.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ids = (url.searchParams.get('ids') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json({ items: [] });
  }
  if (ids.length > 200) {
    return NextResponse.json({ error: 'Liian monta tuotetta.' }, { status: 400 });
  }

  const items = await prisma.item.findMany({
    where: { id: { in: ids }, active: true },
    select: { id: true, slug: true, name: true, priceCents: true, imageUrl: true, stock: true },
  });

  return NextResponse.json({ items });
}
