'use client';

import { useEffect } from 'react';
import { cartStore } from '@/lib/cart';

export function ClearCartOnSuccess() {
  useEffect(() => {
    cartStore.clear();
  }, []);

  return null;
}
