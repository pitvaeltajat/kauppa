import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/money';
import { hideItem } from '@/lib/actions/admin';
import { requireSuperAdmin } from '@/lib/admin-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Tuotteet' };

export default async function AdminItemsPage() {
  await requireSuperAdmin();
  const items = await prisma.item.findMany({
    orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
    include: { category: true },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tuotteet ({items.length})</h1>
        <Link href="/admin/items/new">
          <Button variant="cta">
            <Plus /> Uusi tuote
          </Button>
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase text-muted-foreground">
              <th className="px-4 py-3">Tuote</th>
              <th className="px-4 py-3">Kategoria</th>
              <th className="px-4 py-3 text-right">Hinta</th>
              <th className="px-4 py-3 text-right">Varasto</th>
              <th className="px-4 py-3">Tila</th>
              <th className="px-4 py-3 text-right">Toiminnot</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/item/${item.slug}`}
                    className="hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.name}
                    <span className="ml-1 text-xs text-muted-foreground">↗</span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{item.category.name}</td>
                <td className="px-4 py-3 text-right">{formatCents(item.priceCents)}</td>
                <td className="px-4 py-3 text-right">
                  {item.stock === null ? '−' : item.stock}
                </td>
                <td className="px-4 py-3">
                  {item.active ? (
                    <Badge variant="success">Näkyvissä</Badge>
                  ) : (
                    <Badge variant="secondary">Piilotettu</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Link href={`/admin/items/${item.id}`}>
                      <Button type="button" size="sm" variant="outline">
                        Muokkaa
                      </Button>
                    </Link>
                    {item.active && (
                      <form action={hideItem}>
                        <input type="hidden" name="id" value={item.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          Piilota
                        </Button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
