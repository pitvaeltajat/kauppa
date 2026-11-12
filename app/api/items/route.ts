import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withEventQuestions } from '@/lib/questions';

/**
 * Fresh catalog rows + checkout questions for the cart. The cart only stores
 * ids and quantities, so the cart page always re-reads names, prices, stock
 * and questions from the database.
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
    select: {
      id: true,
      slug: true,
      name: true,
      imageUrl: true,
      stock: true,
      isEvent: true,
      leaderDiscount: true,
      variants: {
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, priceCents: true },
      },
      questions: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, prompt: true, type: true, required: true, options: true },
      },
    },
  });

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      slug: item.slug,
      name: item.name,
      imageUrl: item.imageUrl,
      stock: item.stock,
      isEvent: item.isEvent,
      leaderDiscount: item.leaderDiscount,
      variants: item.variants,
      questions: withEventQuestions(
        item.isEvent,
        item.questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          type: q.type,
          required: q.required,
          options: q.options as string[],
        })),
      ),
    })),
  });
}
