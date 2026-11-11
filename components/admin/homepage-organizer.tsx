'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowRight, GripVertical, Plus } from 'lucide-react';
import { reorderHomepageItems } from '@/lib/actions/admin';
import { ItemCard, type ItemCardData } from '@/components/item-card';
import { ButtonLink } from '@/components/ui/button-link';
import { cn } from '@/lib/cn';

type OrganizerItem = ItemCardData & {
  categoryId: string;
  featured: boolean;
  featuredOrder: number;
};

type OrganizerCategory = {
  id: string;
  name: string;
  slug: string;
  items: OrganizerItem[];
};

export function HomepageOrganizer({
  categories,
  canReorderProducts,
}: {
  categories: OrganizerCategory[];
  canReorderProducts: boolean;
}) {
  const [groups, setGroups] = useState(categories);
  const [featured, setFeatured] = useState(
    categories
      .flatMap((category) => category.items.filter((item) => item.featured))
      .sort((a, b) => a.featuredOrder - b.featuredOrder),
  );
  const [dragged, setDragged] = useState<OrganizerItem | null>(null);
  const [draggedFrom, setDraggedFrom] = useState<'featured' | 'category' | null>(null);
  const [pending, startTransition] = useTransition();
  const eventCategoryId = categories.find((category) => category.slug === 'tapahtumat')?.id;

  function canDrag(item: OrganizerItem) {
    return canReorderProducts || item.categoryId === eventCategoryId;
  }

  function save(categoryId: string, items: OrganizerItem[], nextFeatured: OrganizerItem[]) {
    const formData = new FormData();
    formData.set('categoryId', categoryId);
    formData.set('itemIds', JSON.stringify(items.map((item) => item.id)));
    formData.set('featuredItemIds', JSON.stringify(nextFeatured.map((item) => item.id)));
    startTransition(() => void reorderHomepageItems(formData));
  }

  function dropOnFeatured(targetId?: string) {
    if (!dragged || !canDrag(dragged)) return;
    const sourceCategory = groups.find((category) => category.id === dragged.categoryId);
    if (!sourceCategory) return;

    const nextGroups = groups;
    const nextFeatured = [...featured.filter((item) => item.id !== dragged.id)];
    const foundIndex = targetId
      ? nextFeatured.findIndex((item) => item.id === targetId)
      : nextFeatured.length;
    nextFeatured.splice(foundIndex < 0 ? nextFeatured.length : foundIndex, 0, {
      ...dragged,
      featured: true,
    });
    setGroups(nextGroups);
    setFeatured(nextFeatured);
    save(sourceCategory.id, sourceCategory.items, nextFeatured);
    setDragged(null);
  }

  function dropOnCategory(categoryId: string, targetId?: string) {
    if (!dragged || dragged.categoryId !== categoryId || !canDrag(dragged)) return;
    const category = groups.find((candidate) => candidate.id === categoryId);
    if (!category) return;
    const nextItems = [...category.items];
    const currentIndex = nextItems.findIndex((item) => item.id === dragged.id);
    if (currentIndex >= 0) nextItems.splice(currentIndex, 1);
    const foundIndex = targetId
      ? nextItems.findIndex((item) => item.id === targetId)
      : nextItems.length;
    nextItems.splice(foundIndex < 0 ? nextItems.length : foundIndex, 0, {
      ...dragged,
      featured: draggedFrom === 'featured' ? false : dragged.featured,
    });
    const nextGroups = groups.map((candidate) =>
      candidate.id === categoryId ? { ...candidate, items: nextItems } : candidate,
    );
    const nextFeatured =
      draggedFrom === 'featured' ? featured.filter((item) => item.id !== dragged.id) : featured;
    setGroups(nextGroups);
    setFeatured(nextFeatured);
    save(categoryId, nextItems, nextFeatured);
    setDragged(null);
  }

  function renderItem(item: OrganizerItem, onDrop: () => void, featuredCard = false) {
    const draggable = canDrag(item);
    return (
      <div
        key={item.id}
        draggable={draggable}
        onDragStart={() => {
          if (draggable) {
            setDragged(item);
            setDraggedFrom(featuredCard ? 'featured' : 'category');
          }
        }}
        onDragEnd={() => {
          setDragged(null);
          setDraggedFrom(null);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        className={cn(
          'relative rounded-lg transition-shadow',
          dragged?.id === item.id && 'opacity-50',
        )}
      >
        {draggable && (
          <div className="pointer-events-none absolute right-2 top-2 z-10 rounded bg-card/90 p-1 text-muted-foreground shadow-sm">
            <GripVertical className="size-4" aria-hidden="true" />
          </div>
        )}
        <ItemCard item={item} featured={featuredCard} />
      </div>
    );
  }

  return (
    <>
      <section
        className={cn('border-t py-8', pending && 'opacity-70')}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => dropOnFeatured()}
      >
        <h2 className="mb-4 text-xl font-bold">Nostot</h2>
        <div className="grid min-h-24 grid-cols-1 gap-4 rounded-lg border border-dashed p-2 md:grid-cols-2">
          {featured.length > 0 ? (
            featured.map((item) => renderItem(item, () => dropOnFeatured(item.id), true))
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Vedä kohde tähän nostoksi.</p>
          )}
        </div>
      </section>

      <section className="space-y-10 pb-8">
        {groups.map((category) => (
          <div key={category.id}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold">{category.name}</h2>
              <div className="flex flex-wrap items-center gap-3">
                {category.slug === 'tapahtumat' && (
                  <ButtonLink href="/admin/events/new" variant="outline" size="sm">
                    <Plus /> Lisää tapahtuma
                  </ButtonLink>
                )}
                <Link
                  href={`/category/${category.slug}`}
                  className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Kaikki tuotteet <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
            <div
              className={cn(
                'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4',
                pending && 'opacity-70',
              )}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dropOnCategory(category.id)}
            >
              {category.items.map((item) =>
                renderItem(item, () => dropOnCategory(category.id, item.id)),
              )}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
