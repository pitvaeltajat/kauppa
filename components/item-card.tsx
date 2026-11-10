import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { formatCents } from '@/lib/money';
import { formatEventDates } from '@/lib/catalog';
import { ItemImage } from '@/components/item-image';
import { cn } from '@/lib/cn';

export type ItemCardData = {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  imageUrl: string | null;
  stock: number | null;
  description: string;
  isEvent?: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
};

export function ItemCard({
  item,
  featured = false,
}: {
  item: ItemCardData;
  /** Featured cards get a larger, horizontal treatment on the front page. */
  featured?: boolean;
}) {
  const soldOut = item.stock === 0;
  const dates = item.isEvent ? formatEventDates(item.startsAt, item.endsAt) : '';
  return (
    <Link
      href={`/item/${item.slug}`}
      className={cn(
        'group overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md',
        featured ? 'flex flex-row' : 'block',
      )}
    >
      <ItemImage
        src={item.imageUrl}
        alt={item.name}
        className={featured ? 'aspect-square w-1/2 shrink-0 rounded-none' : undefined}
      />
      <div className={featured ? 'min-w-0 flex-1 p-4 sm:p-5' : 'p-4'}>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="min-w-0 truncate text-sm font-semibold" title={item.name}>
            {item.name}
          </h3>
          <span className="shrink-0 text-sm font-bold">{formatCents(item.priceCents)}</span>
        </div>
        {dates && (
          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-primary">
            <CalendarDays className="size-3.5" /> {dates}
          </p>
        )}
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
        <p className="mt-2 text-xs">
          {soldOut ? (
            <span className="font-medium text-destructive">Loppu varastosta</span>
          ) : item.stock !== null ? (
            <span className="text-muted-foreground">{item.stock} varastossa</span>
          ) : (
            <span className="text-muted-foreground">Saatavilla</span>
          )}
        </p>
      </div>
    </Link>
  );
}
