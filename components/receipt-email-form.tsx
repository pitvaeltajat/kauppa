'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingPill } from '@/components/ui/loading-pill';

export function ReceiptEmailForm({ sessionId }: { sessionId: string }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/success/receipt-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, email }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? 'Kuittia ei voitu lähettää.');
        return;
      }
      setSent(true);
    } catch {
      setError('Kuittia ei voitu lähettää. Tarkista yhteys ja yritä uudelleen.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <p className="rounded-md bg-accent/60 px-4 py-3 text-sm">Kuitti lähetetään sähköpostiin.</p>
    );
  }

  return (
    <div className="space-y-2 rounded-md border bg-background px-4 py-3">
      <p className="text-sm font-medium">Haluatko kuitin sähköpostiin?</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="sinä@example.com"
          aria-label="Sähköpostiosoite kuittia varten"
        />
        <Button
          type="button"
          variant="outline"
          onClick={submit}
          disabled={loading || !email.trim()}
        >
          {loading ? <LoadingPill /> : 'Lähetä kuitti'}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
