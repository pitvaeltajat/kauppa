'use client';

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/lib/cart';

export function CartButton() {
  const { count } = useCart();
  return (
    <Link
      href="/cart"
      className="relative inline-flex h-9 shrink-0 items-center gap-2 rounded-md bg-header-foreground/10 px-3 text-sm font-medium text-header-foreground transition-colors hover:bg-header-foreground/20"
      aria-label={`Ostoskori${count > 0 ? `, ${count} tuotetta` : ''}`}
    >
      <ShoppingCart className="size-4" />
      <span className="hidden sm:inline">Ostoskori</span>
      {count > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-cta px-1 text-xs font-bold text-header">
          {count}
        </span>
      )}
    </Link>
  );
}
