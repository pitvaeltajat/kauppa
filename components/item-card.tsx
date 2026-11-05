import Link from 'next/link';
import { formatCents } from '@/lib/money';
import { ItemImage } from '@/components/item-image';

export type ItemCardData = {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  imageUrl: string | null;
  stock: number | null;
  description: string;
};

export function ItemCard({ item }: { item: ItemCardData }) {
  const soldOut = item.stock === 0;
  return (
    <Link
      href={`/item/${item.slug}`}
      className="group block overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md"
    >
      <ItemImage src={item.imageUrl} alt={item.name} />
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="min-w-0 truncate text-sm font-semibold" title={item.name}>
            {item.name}
          </h3>
          <span className="shrink-0 text-sm font-bold">{formatCents(item.priceCents)}</span>
        </div>
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
