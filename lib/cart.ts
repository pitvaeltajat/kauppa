'use client';

import { useSyncExternalStore } from 'react';

// The cart lives in the browser: a tiny module store persisted to localStorage,
// read with useSyncExternalStore so any component (header badge, item buttons,
// the cart page) sees changes without a React context provider at the root.
//
// Only ids, variant ids and quantities that change are kept. Name, price and image come
// from the server at render time. The checkout route re-reads prices from the
// database, so a stale client copy can never charge the wrong amount.

export type CartItem = {
  id: string;
  variantId?: string;
  quantity: number;
};

const STORAGE_KEY = 'kontti-cart';

function load(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is CartItem =>
          typeof x === 'object' && x !== null && typeof (x as CartItem).id === 'string',
      )
      .map((x) => ({
        id: x.id,
        ...(typeof x.variantId === 'string' ? { variantId: x.variantId } : {}),
        quantity: Math.max(1, Math.trunc(x.quantity || 1)),
      }));
  } catch {
    return [];
  }
}

let items: CartItem[] = load();
const listeners = new Set<() => void>();

// Stable snapshot for server rendering. React requires getServerSnapshot to
// return a cached value, so this is a module constant, never a fresh array.
const EMPTY_CART: CartItem[] = [];

function emit() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage may be unavailable (private mode); the cart still works in memory.
  }
  for (const listener of listeners) listener();
}

export const cartStore = {
  getItems(): CartItem[] {
    return items;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  add(id: string, quantity = 1, variantId?: string) {
    const existing = items.find((i) => i.id === id && i.variantId === variantId);
    if (existing) {
      // Always produce a new array so useSyncExternalStore re-renders.
      items = items.map((i) =>
        i.id === id && i.variantId === variantId ? { ...i, quantity: i.quantity + quantity } : i,
      );
    } else {
      items = [...items, { id, ...(variantId ? { variantId } : {}), quantity }];
    }
    emit();
  },
  setQuantity(id: string, quantity: number, variantId?: string) {
    const q = Math.max(1, Math.trunc(quantity));
    items = items.map((i) =>
      i.id === id && i.variantId === variantId ? { ...i, quantity: q } : i,
    );
    emit();
  },
  remove(id: string, variantId?: string) {
    items = items.filter((i) => !(i.id === id && i.variantId === variantId));
    emit();
  },
  clear() {
    items = [];
    emit();
  },
};

export function useCart(): { items: CartItem[]; count: number } {
  // getServerSnapshot: during SSR the store has nothing meaningful (localStorage
  // does not exist), so the server always renders the empty cart.
  const snapshot = useSyncExternalStore(cartStore.subscribe, cartStore.getItems, () => EMPTY_CART);
  return { items: snapshot, count: snapshot.reduce((sum, i) => sum + i.quantity, 0) };
}
