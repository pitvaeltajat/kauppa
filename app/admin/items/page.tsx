import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/money';
import { hideItem } from '@/lib/actions/admin';
import { requireSuperAdmin } from '@/lib/admin-guard';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { FormButton } from '@/components/admin/form-button';
import { lowestVariantPrice } from '@/lib/catalog';

export const metadata: Metadata = { title: 'Tuotteet' };

export default async function AdminItemsPage() {
  await requireSuperAdmin();
  const items = await prisma.item.findMany({
    where: { isEvent: false },
    orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      category: true,
      variants: { where: { active: true }, select: { priceCents: true } },
    },
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Tuotteet ({items.length})</h1>
        <ButtonLink href="/admin/items/new" variant="cta">
          <Plus /> Uusi tuote
        </ButtonLink>
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
              <th className="px-4 py-3">Etusivu</th>
              <th className="px-4 py-3 text-right">Toiminnot</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b transition-colors last:border-0 hover:bg-muted/40"
              >
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
                <td className="px-4 py-3 text-right">
                  {formatCents(lowestVariantPrice(item.variants))}
                </td>
                <td className="px-4 py-3 text-right">{item.stock === null ? '−' : item.stock}</td>
                <td className="px-4 py-3">
                  {item.active ? (
                    <Badge variant="success">Näkyvissä</Badge>
                  ) : (
                    <Badge variant="secondary">Piilotettu</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {item.featured ? 'Nosto' : ''}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <ButtonLink href={`/admin/items/${item.id}`} size="sm" variant="outline">
                      Muokkaa
                    </ButtonLink>
                    {item.active && (
                      <form action={hideItem}>
                        <input type="hidden" name="id" value={item.id} />
                        <FormButton
                          size="sm"
                          variant="ghost"
                          confirm={`Piilota "${item.name}" kaupasta? Voit palauttaa sen muokkaamalla.`}
                        >
                          Piilota
                        </FormButton>
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
