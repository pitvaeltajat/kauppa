import type { Metadata } from 'next';
import { CartShell } from '@/components/cart-shell';

export const metadata: Metadata = { title: 'Ostoskori' };

export default function CartPage() {
  return (
    <div className="container py-8">
      <h1 className="mb-6 text-2xl font-bold">Ostoskori</h1>
      <CartShell />
    </div>
  );
}
