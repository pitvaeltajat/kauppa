'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cartStore } from '@/lib/cart';
import { cn } from '@/lib/cn';
import { formatCents } from '@/lib/money';
import { Button } from '@/components/ui/button';

export function AddToCartForm({
  itemId,
  variants = [],
  withQuantity = false,
  disabled = false,
  className,
}: {
  itemId: string;
  variants?: { id: string; name: string | null; priceCents: number }[];
  withQuantity?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [quantity, setQuantity] = useState(1);
  const [variantId, setVariantId] = useState(variants[0]?.id ?? '');
  const [added, setAdded] = useState(false);

  function handleAdd() {
    cartStore.add(itemId, quantity, variantId || undefined);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {variants.length > 1 && (
        <label className="flex min-w-56 flex-col gap-1 text-sm">
          <span className="font-medium">Vaihtoehto</span>
          <select
            value={variantId}
            onChange={(event) => setVariantId(event.target.value)}
            className="h-10 rounded-md border border-input bg-card px-3 text-sm"
          >
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.name} - {formatCents(variant.priceCents)}
              </option>
            ))}
          </select>
        </label>
      )}
      {withQuantity && (
        <div className="flex h-10 items-center rounded-md border border-input bg-card">
          <button
            type="button"
            aria-label="Vähennä määrää"
            className="flex h-full w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            <Minus className="size-4" />
          </button>
          <span className="w-10 text-center text-sm font-medium" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            aria-label="Lisää määrää"
            className="flex h-full w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setQuantity((q) => Math.min(99, q + 1))}
          >
            <Plus className="size-4" />
          </button>
        </div>
      )}
      <Button type="button" disabled={disabled} onClick={handleAdd} className="min-w-44">
        {added ? 'Lisätty koriin' : 'Lisää ostoskoriin'}
      </Button>
    </div>
  );
}
