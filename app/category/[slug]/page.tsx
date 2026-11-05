import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { ItemCard } from '@/components/item-card';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await prisma.category.findUnique({ where: { slug } });
  return { title: category ? category.name : 'Kategoria' };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      items: {
        where: { active: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      },
    },
  });

  if (!category) notFound();

  return (
    <div className="container py-8">
      <nav className="mb-4 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground hover:underline">
          Etusivu
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">{category.name}</span>
      </nav>

      <h1 className="text-2xl font-bold">{category.name}</h1>
      {category.description && <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>}

      {category.items.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed bg-card px-4 py-8 text-sm text-muted-foreground">
          Tästä kategoriasta ei ole vielä tuotteita. Katso muita osastoja!
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {category.items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
