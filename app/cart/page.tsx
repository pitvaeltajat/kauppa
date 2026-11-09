import type { Metadata } from 'next';
import { CartShell } from '@/components/cart-shell';
import { auth } from '@/lib/auth';

export const metadata: Metadata = { title: 'Ostoskori' };

export default async function CartPage() {
  const session = await auth();

  return (
    <div className="container py-8">
      <h1 className="mb-6 text-2xl font-bold">Ostoskori</h1>
      <CartShell
        initialUser={{
          name: session?.user?.name ?? '',
          email: session?.user?.email ?? '',
        }}
      />
    </div>
  );
}
