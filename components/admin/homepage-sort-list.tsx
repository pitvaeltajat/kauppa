'use client';

import { useState, useTransition } from 'react';
import { GripVertical } from 'lucide-react';
import { reorderHomepageItems } from '@/lib/actions/admin';
import { ItemCard, type ItemCardData } from '@/components/item-card';
import { cn } from '@/lib/cn';

export function HomepageSortList({
  categoryId,
  items,
}: {
  categoryId: string;
  items: ItemCardData[];
}) {
  const [orderedItems, setOrderedItems] = useState(items);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function moveItem(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    const from = orderedItems.findIndex((item) => item.id === draggedId);
    const to = orderedItems.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;

    const next = [...orderedItems];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrderedItems(next);

    const formData = new FormData();
    formData.set('categoryId', categoryId);
    formData.set('itemIds', JSON.stringify(next.map((item) => item.id)));
    startTransition(() => {
      void reorderHomepageItems(formData);
    });
  }

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4',
        pending && 'opacity-70',
      )}
    >
      {orderedItems.map((item) => (
        <div
          key={item.id}
          draggable
          onDragStart={() => setDraggedId(item.id)}
          onDragEnd={() => setDraggedId(null)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => moveItem(item.id)}
          className={cn(
            'relative rounded-lg transition-shadow',
            draggedId === item.id && 'opacity-50',
          )}
        >
          <div className="pointer-events-none absolute right-2 top-2 z-10 rounded bg-card/90 p-1 text-muted-foreground shadow-sm">
            <GripVertical className="size-4" aria-hidden="true" />
          </div>
          <ItemCard item={item} />
        </div>
      ))}
    </div>
  );
}
