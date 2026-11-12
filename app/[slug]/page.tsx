import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, CalendarDays, Pencil } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/money';
import { formatEventDates, isEventOver } from '@/lib/catalog';
import { ItemImage } from '@/components/item-image';
import { AddToCartForm } from '@/components/add-to-cart-form';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button-link';
import { adminRole } from '@/lib/admin-guard';
import { isEventAdmin, isSuperAdmin } from '@/lib/admin';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = await prisma.item.findUnique({ where: { slug }, select: { name: true } });
  return { title: item ? item.name : 'Tuote' };
}

export default async function ItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await prisma.item.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      imageUrl: true,
      stock: true,
      isEvent: true,
      startsAt: true,
      endsAt: true,
      description: true,
      active: true,
      category: { select: { id: true, name: true, slug: true } },
      variants: {
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, priceCents: true },
      },
    },
  });

  if (!item || !item.active) notFound();

  const soldOut = item.stock === 0;
  const eventDates = item.isEvent ? formatEventDates(item.startsAt, item.endsAt) : '';
  const eventOver = item.isEvent && isEventOver(item.endsAt);
  const role = await adminRole();
  const canEdit = item.isEvent ? isEventAdmin(role) : isSuperAdmin(role);

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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="mt-1 text-2xl font-bold">{item.name}</h1>
            {canEdit && (
              <ButtonLink
                href={item.isEvent ? `/admin/events/${item.id}` : `/admin/items/${item.id}`}
                variant="outline"
                size="sm"
              >
                <Pencil /> Muokkaa
              </ButtonLink>
            )}
          </div>
          {eventDates && (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary">
              <CalendarDays className="size-4" /> {eventDates}
            </p>
          )}
          <p className="mt-3 text-3xl font-bold">
            {(() => {
              const priceCents =
                item.variants.length > 1
                  ? Math.min(...item.variants.map((variant) => variant.priceCents))
                  : (item.variants[0]?.priceCents ?? 0);
              return item.isEvent && priceCents === 0
                ? 'Maksuton ilmoittautuminen'
                : `${item.variants.length > 1 ? 'Alkaen ' : ''}${formatCents(priceCents)}`;
            })()}
          </p>

          {eventOver && (
            <p className="mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              Tapahtuma on jo päättynyt. Ilmoittautuminen ei välttämättä ole enää mahdollista.
            </p>
          )}

          {!item.isEvent && (
            <div className="mt-3">
              {soldOut ? (
                <Badge variant="destructive">Loppu varastosta</Badge>
              ) : item.stock !== null ? (
                <Badge variant="success">{item.stock} varastossa</Badge>
              ) : (
                <Badge variant="secondary">Saatavilla</Badge>
              )}
            </div>
          )}

          {item.description && (
            <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          )}

          <div className="mt-6">
            <AddToCartForm
              itemId={item.id}
              variants={item.variants}
              withQuantity
              isEvent={item.isEvent}
              disabled={soldOut}
            />
          </div>

          <Card className="mt-8 p-5 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">
              {item.isEvent ? 'Ilmoittautuminen' : 'Nouto'}
            </p>
            <p className="mt-2">
              {item.isEvent
                ? 'Maksat tapahtuman verkossa. Tapahtumatuotteen ostaminen toimii samalla ilmoittautumisena. Saat kuitin sähköpostiisi.'
                : 'Maksat tuotteen verkossa ja noudat sen kokouksessa ryhmänjohtajalta tai erikseen sovittuna aikana kololta. Saat kuitin sähköpostiisi.'}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
