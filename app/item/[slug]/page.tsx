import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { ChevronRight, CalendarDays } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/money';
import { formatEventDates, isEventOver } from '@/lib/catalog';
import { ItemImage } from '@/components/item-image';
import { AddToCartForm } from '@/components/add-to-cart-form';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = await prisma.item.findUnique({ where: { slug } });
  return { title: item ? item.name : 'Tuote' };
}

export default async function ItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await prisma.item.findUnique({
    where: { slug },
    include: { category: true },
  });

  if (!item) {
    // Maybe this is an old slug the item has since moved off. Keep the shared
    // link working by redirecting to the current URL.
    const alias = await prisma.itemSlug.findUnique({ where: { slug }, include: { item: true } });
    if (alias?.item.active) permanentRedirect(`/item/${alias.item.slug}`);
    notFound();
  }
  if (!item.active) notFound();

  const soldOut = item.stock === 0;
  const eventDates = item.isEvent ? formatEventDates(item.startsAt, item.endsAt) : '';
  const eventOver = item.isEvent && isEventOver(item.endsAt);

  return (
    <div className="container py-8">
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground hover:underline">
          Etusivu
        </Link>
        <ChevronRight className="size-3.5" />
        <Link
          href={`/category/${item.category.slug}`}
          className="hover:text-foreground hover:underline"
        >
          {item.category.name}
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">{item.name}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <ItemImage src={item.imageUrl} alt={item.name} className="md:max-w-xl" />
        <div>
          <p className="text-sm text-muted-foreground">{item.category.name}</p>
          <h1 className="mt-1 text-2xl font-bold">{item.name}</h1>
          {eventDates && (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary">
              <CalendarDays className="size-4" /> {eventDates}
            </p>
          )}
          <p className="mt-3 text-3xl font-bold">{formatCents(item.priceCents)}</p>

          {eventOver && (
            <p className="mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              Tapahtuma on jo päättynyt. Ilmoittautuminen ei välttämättä ole enää mahdollista.
            </p>
          )}

          <div className="mt-3">
            {soldOut ? (
              <Badge variant="destructive">Loppu varastosta</Badge>
            ) : item.stock !== null ? (
              <Badge variant="success">{item.stock} varastossa</Badge>
            ) : (
              <Badge variant="secondary">Saatavilla</Badge>
            )}
          </div>

          {item.description && (
            <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          )}

          <div className="mt-6">
            <AddToCartForm itemId={item.id} withQuantity disabled={soldOut} />
          </div>

          <Card className="mt-8 p-5 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Nouto</p>
            <p className="mt-2">
              Maksat tuotteen verkossa ja noudat sen kokouksessa ryhmänjohtajalta tai erikseen
              sovittuna aikana kololta. Tapahtumatuotteen ostaminen toimii samalla
              ilmoittautumisena. Saat kuitin sähköpostiisi.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
