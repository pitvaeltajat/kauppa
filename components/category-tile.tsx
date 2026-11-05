import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export type CategoryTileData = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  itemCount: number;
};

export function CategoryTile({ category }: { category: CategoryTileData }) {
  return (
    <Link
      href={`/category/${category.slug}`}
      className="group flex flex-col justify-between gap-4 rounded-lg border bg-card p-6 text-card-foreground shadow-sm transition-shadow hover:shadow-md"
    >
      <div>
        <h2 className="text-lg font-bold">{category.name}</h2>
        {category.description && (
          <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
        )}
      </div>
      <span className="flex items-center gap-1 text-sm font-medium text-primary">
        {category.itemCount} tuotetta
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
