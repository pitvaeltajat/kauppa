'use client';

import { useEffect, useState } from 'react';
import { Copy, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingPill } from '@/components/ui/loading-pill';

export function KammiPayment({ token, name, start, end, nights, total }: { token: string; name: string; start: string; end: string; nights: number; total: string }) {
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setUrl(window.location.href), []);
  const message = `Hei! Kammin varaus ${start}–${end} (${nights} yötä) on tehty nimellä ${name}. Hinta on ${total}. Voit maksaa varauksen tästä: ${url}`;
  async function share() {
    if (navigator.share) await navigator.share({ title: 'Kammin maksu', text: message, url });
    else { await navigator.clipboard.writeText(message); setCopied(true); }
  }
  async function pay() {
    setError(null); setLoading(true);
    try {
      const res = await fetch(`/api/kammi/payment/${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() || undefined }) });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) { setError(data.error ?? 'Maksua ei voitu aloittaa.'); return; }
      window.location.assign(data.url);
    } catch { setError('Yhteysvirhe. Yritä uudelleen.'); } finally { setLoading(false); }
  }
  return <div className="container flex justify-center py-12"><Card className="w-full max-w-xl"><CardHeader className="items-center text-center"><Share2 className="size-12 text-primary" /><CardTitle>Kammin maksu</CardTitle></CardHeader><CardContent className="space-y-5"><div className="rounded-md border p-4 text-sm"><p className="font-semibold">Kammi</p><p>{start} – {end} ({nights} yötä)</p><p className="mt-2">Varaaja: {name}</p><p className="mt-2 text-lg font-bold">{total}</p></div><p className="text-sm text-muted-foreground">Varaus on pidossa maksua varten. Jaa tämä maksuohje maksajalle. Varaus vapautuu, jos sitä ei makseta 24 tunnin kuluessa.</p><div className="grid gap-2 sm:grid-cols-2"><Button variant="cta" onClick={share}><Share2 className="size-4" /> Jaa maksuohje</Button><Button variant="outline" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); }}><Copy className="size-4" /> {copied ? 'Linkki kopioitu' : 'Kopioi linkki'}</Button></div><a className="block text-center text-sm text-primary underline" href={`mailto:?subject=${encodeURIComponent('Kammin maksu')}&body=${encodeURIComponent(message)}`}>Lähetä sähköpostilla</a><div className="space-y-3 border-t pt-4"><div className="space-y-1.5"><Label htmlFor="kammi-payer-email">Maksajan sähköposti (valinnainen)</Label><Input id="kammi-payer-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="maksaja@example.com" /></div><Button variant="cta" className="w-full" onClick={pay} disabled={loading}>{loading ? <LoadingPill className="bg-current/25" /> : 'Maksa nyt'}</Button></div>{error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}</CardContent></Card></div>;
}
