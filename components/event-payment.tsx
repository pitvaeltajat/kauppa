'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { CheckCircle2, Copy, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingPill } from '@/components/ui/loading-pill';

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
  const [parentEmail, setParentEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);
  // window.location only exists on the client. Reading it during render makes
  // the client output differ from the server HTML (the mailto href below), so
  // render the empty server snapshot first and let React swap in the real link
  // after hydration. Same pattern as KammiPayment.
  const url = useSyncExternalStore(
    () => () => {},
    () => window.location.href,
    () => '',
  );
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

  async function sendInstructions() {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/event-payment/${encodeURIComponent(token)}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: parentEmail.trim() }),
      });
      const data = (await response.json()) as { error?: string; sent?: boolean };
      if (!response.ok || !data.sent) {
        setError(data.error ?? 'Maksuohjetta ei voitu lähettää.');
        return;
      }
      setParentEmail('');
      setCopied(false);
    } catch {
      setError('Maksuohjetta ei voitu lähettää. Tarkista yhteys ja yritä uudelleen.');
    } finally {
      setLoading(false);
    }
  }

  async function openPayment() {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/event-payment/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = (await response.json()) as {
        checkoutUrl?: string;
        error?: string;
        alreadyPaid?: boolean;
      };
      if (!response.ok || !data.checkoutUrl) {
        setError(
          data.alreadyPaid
            ? 'Tämä ilmoittautuminen on jo maksettu.'
            : (data.error ?? 'Maksua ei voitu aloittaa.'),
        );
        return;
      }
      window.location.assign(data.checkoutUrl);
    } catch {
      setError('Maksua ei voitu aloittaa. Tarkista yhteys ja yritä uudelleen.');
    } finally {
      setLoading(false);
    }
  }

  const paid = currentStatus === 'PAID' || currentStatus === 'COMPLETED';
  const cancelled = currentStatus === 'CANCELLED';
  async function cancelRegistration() {
    if (!window.confirm('Perutaanko ilmoittautuminen? Tätä ei voi palauttaa tästä linkistä.'))
      return;
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/event-payment/${encodeURIComponent(token)}/cancel`, {
        method: 'POST',
      });
      const data = (await response.json()) as { error?: string; cancelled?: boolean };
      if (!response.ok || !data.cancelled) {
        setError(data.error ?? 'Ilmoittautumista ei voitu perua.');
        return;
      }
      setCurrentStatus('CANCELLED');
    } catch {
      setError('Ilmoittautumista ei voitu perua. Tarkista yhteys ja yritä uudelleen.');
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="container flex justify-center py-12">
      <Card className="w-full max-w-2xl">
        <CardHeader className="items-center text-center">
          {paid ? (
            <CheckCircle2 className="size-12 text-success" />
          ) : (
            <Share2 className="size-12 text-primary" />
          )}
          <CardTitle>
            {paid
              ? 'Ilmoittautuminen on maksettu'
              : cancelled
                ? 'Ilmoittautuminen on peruttu'
                : 'Tapahtumamaksu'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-md border p-4 text-sm">
            <p className="font-semibold">{eventName}</p>
            {dates && <p className="text-muted-foreground">{dates}</p>}
            {participants.length > 0 && (
              <p className="mt-2">Osallistuja: {participants.join(', ')}</p>
            )}
            <p className="mt-2 text-lg font-bold">{total}</p>
          </div>

          {!paid && !cancelled && (
            <div className="space-y-4">
              <section className="space-y-4 rounded-lg border-2 border-primary/20 bg-primary/5 p-5">
                <div>
                  <h2 className="text-lg font-bold">Osallistujalle</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ilmoittautuminen on vastaanotettu. Jaa maksuohje vanhemmalle, jotta hän voi
                    maksaa omalla laitteellaan.
                  </p>
                </div>
                <Button type="button" variant="cta" className="w-full" onClick={share}>
                  <Share2 className="size-4" /> Jaa maksuohje vanhemmalle
                </Button>
                <div className="grid gap-2">
                  <Button type="button" variant="outline" onClick={copyLink}>
                    <Copy className="size-4" /> {copied ? 'Linkki kopioitu' : 'Kopioi linkki'}
                  </Button>
                </div>
                <div className="space-y-2 border-t border-primary/15 pt-3">
                  <Label htmlFor="parent-email">Tai lähetä maksuohje vanhemman sähköpostiin</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="parent-email"
                      type="email"
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                      placeholder="vanhempi@example.com"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={sendInstructions}
                      disabled={loading || !parentEmail.trim()}
                    >
                      Lähetä ohje
                    </Button>
                  </div>
                </div>
              </section>

              <section className="space-y-4 rounded-lg border p-5">
                <div>
                  <h2 className="text-lg font-bold">Vanhemmalle</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Avaa maksuohje ja maksa ilmoittautuminen. Maksu vahvistaa osallistumisen.
                  </p>
                </div>
                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="cta"
                    className="w-full"
                    onClick={openPayment}
                    disabled={loading}
                  >
                    {loading ? <LoadingPill className="bg-current/25" /> : 'Maksa nyt'}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={cancelRegistration}
                  disabled={loading}
                >
                  Peru ilmoittautuminen
                </Button>
              </section>
              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
          )}
          {paid && (
            <p className="text-center text-sm text-muted-foreground">
              Maksu on vastaanotettu ja ilmoittautuminen vahvistettu.
            </p>
          )}
          {cancelled && (
            <p className="text-center text-sm text-muted-foreground">
              Ilmoittautuminen on peruttu. Maksulinkki ei ole enää käytettävissä.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
