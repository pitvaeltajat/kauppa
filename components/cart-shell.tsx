'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Minus, Plus, Trash2, ShoppingCart } from 'lucide-react';
import { cartStore, useCart } from '@/lib/cart';
import { formatCents } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ItemImage } from '@/components/item-image';

type FetchedItem = {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  stock: number | null;
};

export function CartShell() {
  const { items } = useCart();
  const [catalog, setCatalog] = useState<Map<string, FetchedItem>>(new Map());
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ids = useMemo(() => items.map((i) => i.id).sort(), [items]);

  // Fetch fresh catalog rows for whatever is in the cart.
  useEffect(() => {
    if (ids.length === 0) return;
    let cancelled = false;
    fetch(`/api/items?ids=${ids.map(encodeURIComponent).join(',')}`)
      .then((r) => r.json())
      .then((data: { items?: FetchedItem[] }) => {
        if (cancelled) return;
        setCatalog(new Map((data.items ?? []).map((item) => [item.id, item])));
      })
      .catch(() => {
        if (!cancelled) setError('Tuotteita ei voitu ladata. Päivitä sivu.');
      });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  const lines = items.flatMap((cartItem) => {
    const item = catalog.get(cartItem.id);
    return [{ cartItem, item }];
  });

  const totalCents = lines.reduce(
    (sum, { cartItem, item }) => sum + (item?.priceCents ?? 0) * cartItem.quantity,
    0,
  );

  async function goToCheckout() {
    setError(null);
    if (lines.length === 0 || lines.some(({ item }) => !item)) {
      setError('Osa tuotteista ei ole enää myynnissä. Poista ne korista.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({ id: i.id, quantity: i.quantity })),
          email: email.trim() || undefined,
          name: name.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Maksun alustus epäonnistui.');
        return;
      }
      if (!data.url) {
        setError('Maksun alustus epäonnistui. Yritä uudelleen.');
        return;
      }
      cartStore.clear();
      window.location.assign(data.url);
    } catch {
      setError('Maksun alustus epäonnistui. Tarkista yhteys ja yritä uudelleen.');
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed bg-card px-6 py-16 text-center">
        <ShoppingCart className="size-10 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-bold">Ostoskori on tyhjä</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Täältä löydät PitVa-tuotteet, huivit ja tapahtumailmoittautumiset.
          </p>
        </div>
        <Link href="/">
          <Button variant="cta">Siirry kauppaan</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {/* Lines */}
      <div className="space-y-3">
        {lines.map(({ cartItem, item }) => (
          <div
            key={cartItem.id}
            className="flex items-start gap-4 rounded-lg border bg-card p-4 shadow-sm"
          >
            <Link href={item ? `/item/${item.slug}` : '#'} className="w-20 shrink-0">
              <ItemImage src={item?.imageUrl} alt={item?.name ?? 'Tuote'} />
            </Link>
            <div className="min-w-0 flex-1">
              {item ? (
                <>
                  <Link href={`/item/${item.slug}`} className="font-medium hover:underline">
                    {item.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {formatCents(item.priceCents)} / kpl
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">Tuote ei ole enää myynnissä</p>
                  <p className="text-sm text-muted-foreground">Poista tuote korista jatkaaksesi.</p>
                </>
              )}
              <div className="mt-2 flex items-center gap-3">
                <div className="flex h-8 items-center rounded-md border border-input bg-background">
                  <button
                    type="button"
                    aria-label="Vähennä"
                    className="flex h-full w-8 items-center justify-center text-muted-foreground hover:text-foreground"
                    onClick={() => cartStore.setQuantity(cartItem.id, cartItem.quantity - 1)}
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm">{cartItem.quantity}</span>
                  <button
                    type="button"
                    aria-label="Lisää"
                    className="flex h-full w-8 items-center justify-center text-muted-foreground hover:text-foreground"
                    onClick={() => cartStore.setQuantity(cartItem.id, cartItem.quantity + 1)}
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                {item && (
                  <span className="text-sm font-semibold">
                    {formatCents(item.priceCents * cartItem.quantity)}
                  </span>
                )}
                <button
                  type="button"
                  aria-label="Poista korista"
                  className="ml-auto text-muted-foreground transition-colors hover:text-destructive"
                  onClick={() => cartStore.remove(cartItem.id)}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="h-fit space-y-4 rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-bold">Yhteenveto</h2>

        <div className="flex items-center justify-between text-sm">
          <span>Yhteensä</span>
          <span className="text-lg font-bold">{formatCents(totalCents)}</span>
        </div>

        <div className="space-y-3 border-t pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Sähköposti (kuitti lähetetään tähän)</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="etunimi@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Nimi</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Etunimi Sukunimi"
            />
          </div>
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        <Button
          variant="cta"
          size="lg"
          className="w-full"
          disabled={loading || lines.length === 0 || lines.some(({ item }) => !item)}
          onClick={goToCheckout}
        >
          {loading ? 'Siirretään maksuun…' : 'Siirry maksamaan (Stripe)'}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Maksu hoituu Stripe Checkoutissa. Tuotteet noudetaan kokouksessa, ei lähetetä postitse.
        </p>
      </div>
    </div>
  );
}

