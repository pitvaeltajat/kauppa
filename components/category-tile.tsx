import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { formatCents } from '@/lib/money';
import { ItemImage } from '@/components/item-image';

export type CategoryTileData = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  itemCount: number;
  previewItems: { id: string; name: string; slug: string; priceCents: number; imageUrl: string | null }[];
};

export function CategoryTile({ category }: { category: CategoryTileData }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-5 text-card-foreground shadow-sm">
      <div>
        <Link href={`/category/${category.slug}`} className="group inline-flex items-center gap-1 text-lg font-bold hover:underline">
          {category.name}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
        {category.description && (
          <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
        )}
      </div>
      {category.previewItems.length > 0 ? (
        <div className="space-y-2">
          {category.previewItems.map((item) => (
            <Link key={item.id} href={`/item/${item.slug}`} className="flex items-center gap-3 rounded-md p-1.5 transition-colors hover:bg-muted">
              <div className="size-12 shrink-0">
                <ItemImage src={item.imageUrl} alt="" className="rounded" />
              </div>
              <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
              <span className="shrink-0 text-sm font-medium">{formatCents(item.priceCents)}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Ei tuotteita vielä.</p>
      )}
      <Link href={`/category/${category.slug}`} className="text-sm font-medium text-primary hover:underline">
        {category.itemCount} tuotetta · Katso kaikki
      </Link>
    </div>
  );
}
