'use client';

import { useMemo, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { CheckCircle2, Copy, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingPill } from '@/components/ui/loading-pill';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

export function EventPayment({
  token,
  eventName,
  dates,
  participants,
  total,
  status,
}: {
  token: string;
  eventName: string;
  dates: string;
  participants: string[];
  total: string;
  status: string;
}) {
  const [email, setEmail] = useState('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const url = typeof window === 'undefined' ? '' : window.location.href;
  const message = useMemo(
    () =>
      `Hei! Olen ilmoittautunut tapahtumaan ${eventName}${dates ? ` (${dates})` : ''}. Hinta on ${total}. Voit maksaa ilmoittautumisen tästä: ${url}`,
    [dates, eventName, total, url],
  );

  async function share() {
    if (navigator.share) {
      await navigator.share({ title: `Tapahtumamaksu: ${eventName}`, text: message, url });
      return;
    }
    await navigator.clipboard.writeText(message);
    setCopied(true);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  async function openPayment() {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/event-payment/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() || undefined }),
      });
      const data = (await response.json()) as { clientSecret?: string; error?: string; alreadyPaid?: boolean };
      if (!response.ok || !data.clientSecret) {
        setError(data.alreadyPaid ? 'Tämä ilmoittautuminen on jo maksettu.' : data.error ?? 'Maksua ei voitu aloittaa.');
        return;
      }
      setClientSecret(data.clientSecret);
    } catch {
      setError('Maksua ei voitu aloittaa. Tarkista yhteys ja yritä uudelleen.');
    } finally {
      setLoading(false);
    }
  }

  const paid = status === 'PAID' || status === 'COMPLETED';
  return (
    <div className="container flex justify-center py-12">
      <Card className="w-full max-w-xl">
        <CardHeader className="items-center text-center">
          {paid ? <CheckCircle2 className="size-12 text-success" /> : <Share2 className="size-12 text-primary" />}
          <CardTitle>{paid ? 'Ilmoittautuminen on maksettu' : 'Tapahtumamaksu'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-md border p-4 text-sm">
            <p className="font-semibold">{eventName}</p>
            {dates && <p className="text-muted-foreground">{dates}</p>}
            {participants.length > 0 && <p className="mt-2">Osallistuja: {participants.join(', ')}</p>}
            <p className="mt-2 text-lg font-bold">{total}</p>
          </div>

          {!paid && (
            <>
              <p className="text-sm text-muted-foreground">
                Ilmoittautuminen on vastaanotettu, mutta se vahvistuu vasta maksun jälkeen. Jaa tämä sivu vanhemmalle.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="cta" onClick={share}>
                  <Share2 className="size-4" /> Jaa vanhemmalle
                </Button>
                <Button type="button" variant="outline" onClick={copyLink}>
                  <Copy className="size-4" /> {copied ? 'Linkki kopioitu' : 'Kopioi linkki'}
                </Button>
              </div>
              <a
                className="block text-center text-sm text-primary underline"
                href={`mailto:?subject=${encodeURIComponent(`Maksu: ${eventName}`)}&body=${encodeURIComponent(message)}`}
              >
                Lähetä sähköpostilla
              </a>
              {!clientSecret && (
                <div className="space-y-3 border-t pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="parent-email">Maksajan sähköposti (valinnainen)</Label>
                    <Input id="parent-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vanhempi@example.com" />
                  </div>
                  <Button type="button" variant="cta" className="w-full" onClick={openPayment} disabled={loading || !stripePromise}>
                    {loading ? <LoadingPill className="bg-current/25" /> : 'Maksa nyt'}
                  </Button>
                </div>
              )}
              {clientSecret && stripePromise && (
                <Elements stripe={stripePromise} options={{ clientSecret, locale: 'fi' }}>
                  <PaymentForm token={token} />
                </Elements>
              )}
              {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            </>
          )}
          {paid && <p className="text-center text-sm text-muted-foreground">Maksu on vastaanotettu ja ilmoittautuminen vahvistettu.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentForm({ token }: { token: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!stripe || !elements) return;
    setError(null);
    setLoading(true);
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/event-payment/${encodeURIComponent(token)}` },
    });
    if (result.error) setError(result.error.message ?? 'Maksu epäonnistui.');
    setLoading(false);
  }

  return (
    <div className="space-y-4 border-t pt-4">
      <PaymentElement />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="button" variant="cta" className="w-full" onClick={submit} disabled={loading || !stripe || !elements}>
        {loading ? <LoadingPill className="bg-current/25" /> : 'Maksa turvallisesti'}
      </Button>
    </div>
  );
}
