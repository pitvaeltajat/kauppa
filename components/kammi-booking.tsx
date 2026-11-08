'use client';

import { useMemo, useState } from 'react';
import { formatCents } from '@/lib/money';
import { addDays, nightsBetween, computeKammiPrice, type KammiPrices, type KammiTier } from '@/lib/kammi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type DayStatus = { m: boolean; n: boolean }; // morningBusy, nightBusy

const WEEKDAYS = ['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su'];
const MONTHS = ['tammikuu', 'helmikuu', 'maaliskuu', 'huhtikuu', 'toukokuu', 'kesäkuu', 'heinäkuu', 'elokuu', 'syyskuu', 'lokakuu', 'marraskuu', 'joulukuu'];

/** Monday-first weekday index (Mon=0 … Sun=6) for a UTC date. */
function mondayIndex(iso: string): number {
  return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
}

function fiDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${Number(d)}.${Number(m)}.${y}`;
}

export function KammiBooking({
  today,
  windowEnd,
  statuses,
  prices,
  minNights,
  maxNights,
  pitvaMember,
}: {
  today: string;
  windowEnd: string;
  statuses: Record<string, DayStatus>;
  prices: KammiPrices;
  minNights: number;
  maxNights: number;
  pitvaMember: boolean;
}) {
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [tier, setTier] = useState<KammiTier>('OTHER');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [organization, setOrganization] = useState('');
  const [eventInfo, setEventInfo] = useState('');
  const [hostQuestions, setHostQuestions] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nightFree = (iso: string) => !statuses[iso]?.n;
  const rangeFree = (s: string, e: string) => {
    for (let d = s; d < e; d = addDays(d, 1)) if (!nightFree(d)) return false;
    return true;
  };

  function handleDay(iso: string) {
    setError(null);
    if (iso < today) return;
    // Start (or restart) a selection.
    if (!start || end || iso <= start) {
      if (!nightFree(iso)) return; // can't arrive on a night that's taken
      setStart(iso);
      setEnd(null);
      return;
    }
    // Choosing the checkout day.
    if (!rangeFree(start, iso)) {
      setError('Valitun ajanjakson välissä on varattuja öitä.');
      return;
    }
    const nights = nightsBetween(start, iso);
    if (nights > maxNights) {
      setError(`Enimmäisvaraus on ${maxNights} yötä.`);
      return;
    }
    setEnd(iso);
  }

  const price = useMemo(
    () => (start && end ? computeKammiPrice(start, end, tier, prices) : null),
    [start, end, tier, prices],
  );
  const nights = start && end ? nightsBetween(start, end) : 0;
  // A logged-in pitva member's scout stay is free (the server enforces this too).
  const isFree = pitvaMember && tier === 'SCOUT';

  async function book() {
    setError(null);
    if (!start || !end) return setError('Valitse tulo- ja lähtöpäivä kalenterista.');
    if (nights < minNights) return setError(`Vähimmäisvaraus on ${minNights} yötä.`);
    if (!name.trim()) return setError('Anna nimi.');
    if (!email.includes('@')) return setError('Anna sähköposti.');
    setLoading(true);
    try {
      const res = await fetch('/api/kammi/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: start,
          endDate: end,
          tier,
          name,
          email,
          phone,
          organization,
          eventInfo,
          hostQuestions,
          billingEmail,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Varauksen aloitus epäonnistui.');
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError('Yhteysvirhe. Yritä uudelleen.');
    } finally {
      setLoading(false);
    }
  }

  // Build the list of months to render, from today's month to windowEnd.
  const months = useMemo(() => {
    const out: { year: number; month: number; firstISO: string }[] = [];
    const [ty, tm] = today.split('-').map(Number);
    const [ey, em] = windowEnd.split('-').map(Number);
    let y = ty;
    let m = tm;
    while (y < ey || (y === ey && m <= em)) {
      out.push({ year: y, month: m, firstISO: `${y}-${String(m).padStart(2, '0')}-01` });
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    return out;
  }, [today, windowEnd]);

  function dayCellStyle(iso: string): React.CSSProperties {
    const inRange = !!(start && ((end && iso >= start && iso < end) || iso === start));
    if (inRange) return { background: 'hsl(var(--cta))' };
    const s = statuses[iso];
    const busy = 'hsl(var(--destructive) / 0.28)';
    if (s?.m && s?.n) return { background: busy };
    if (s?.m) return { background: `linear-gradient(135deg, ${busy} 0 50%, transparent 50% 100%)` };
    if (s?.n) return { background: `linear-gradient(135deg, transparent 0 50%, ${busy} 50% 100%)` };
    return {};
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        {/* Legend */}
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3.5 rounded-sm border" /> Vapaa
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3.5 rounded-sm" style={{ background: 'hsl(var(--destructive) / 0.28)' }} />
            Varattu
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block size-3.5 rounded-sm border"
              style={{ background: 'linear-gradient(135deg, hsl(var(--destructive) / 0.28) 0 50%, transparent 50% 100%)' }}
            />
            Vaihtopäivä (osittain vapaa)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3.5 rounded-sm" style={{ background: 'hsl(var(--cta))' }} /> Valittu
          </span>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {months.map(({ year, month, firstISO }) => {
            const lead = mondayIndex(firstISO);
            const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
            return (
              <div key={firstISO}>
                <p className="mb-2 text-sm font-semibold capitalize">
                  {MONTHS[month - 1]} {year}
                </p>
                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                  {WEEKDAYS.map((w) => (
                    <div key={w} className="pb-1 font-medium text-muted-foreground">
                      {w}
                    </div>
                  ))}
                  {Array.from({ length: lead }).map((_, i) => (
                    <div key={`b${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const past = iso < today || iso >= windowEnd;
                    const selected = !!(start && iso === start) || !!(end && iso === end);
                    return (
                      <button
                        key={iso}
                        type="button"
                        disabled={past}
                        onClick={() => handleDay(iso)}
                        style={dayCellStyle(iso)}
                        className={`flex aspect-square items-center justify-center rounded-md border text-sm transition-colors ${
                          past ? 'cursor-not-allowed text-muted-foreground/40' : 'hover:border-primary'
                        } ${selected ? 'font-bold text-cta-foreground ring-2 ring-primary' : ''}`}
                        aria-label={`${fiDate(iso)}${statuses[iso]?.n ? ' (varattu)' : ''}`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Booking panel */}
      <div className="h-fit space-y-4 rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-bold">Varaus</h2>

        <div className="rounded-md bg-background p-3 text-sm">
          {start && end ? (
            <>
              <p>
                <span className="text-muted-foreground">Tulo:</span> {fiDate(start)}
              </p>
              <p>
                <span className="text-muted-foreground">Lähtö:</span> {fiDate(end)} ({nights} yötä)
              </p>
            </>
          ) : start ? (
            <p className="text-muted-foreground">Valitse lähtöpäivä kalenterista.</p>
          ) : (
            <p className="text-muted-foreground">Valitse tulopäivä kalenterista.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Hinnoittelu</Label>
          <div className="flex gap-2">
            {(['SCOUT', 'OTHER'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTier(t)}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  tier === t ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent'
                }`}
              >
                {t === 'SCOUT' ? 'Partiolainen' : 'Muu'}
              </button>
            ))}
          </div>
        </div>

        {price && (
          <div className="flex items-center justify-between border-t pt-3 text-sm">
            <span>Hinta</span>
            {isFree ? (
              <span className="text-lg font-bold text-success">Maksuton (partio)</span>
            ) : (
              <span className="text-lg font-bold">{formatCents(price.totalCents)}</span>
            )}
          </div>
        )}
        {pitvaMember && (
          <p className="text-xs text-muted-foreground">
            PitVa-jäsenille partiotoiminnan varaus on maksuton. Muu käyttö normaalihintaan.
          </p>
        )}

        <div className="space-y-3 border-t pt-3">
          <div className="space-y-1.5">
            <Label htmlFor="k-name">Nimi</Label>
            <Input id="k-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Etunimi Sukunimi" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="k-email">Sähköposti (ohjeet ja ovikoodi tähän)</Label>
            <Input id="k-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="etunimi@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="k-phone">Puhelinnumero</Label>
            <Input id="k-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="040 1234567" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="k-org">Edustamasi taho</Label>
            <Input id="k-org" value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="esim. lippukunta tai yksityinen" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="k-info">Tapahtuman tiedot</Label>
            <Textarea id="k-info" rows={3} value={eventInfo} onChange={(e) => setEventInfo(e.target.value)} placeholder="Millainen tapahtuma, osallistujamäärä…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="k-q">Kysymykset kämppäisännälle (valinnainen)</Label>
            <Textarea id="k-q" rows={2} value={hostQuestions} onChange={(e) => setHostQuestions(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="k-bill">Laskutusosoite / sähköposti (valinnainen)</Label>
            <Input id="k-bill" type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} placeholder="jos eri kuin yllä" />
          </div>
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        <Button variant="cta" size="lg" className="w-full" disabled={loading || !start || !end} onClick={book}>
          {loading ? (isFree ? 'Varataan…' : 'Siirretään maksuun…') : isFree ? 'Varaa (maksuton)' : 'Varaa ja maksa'}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {isFree
            ? 'Ovikoodi ja ohjeet tulevat sähköpostiisi heti varauksen jälkeen.'
            : 'Vuoro varmistuu maksamalla. Ovikoodi ja ohjeet tulevat sähköpostiin maksun jälkeen.'}
        </p>
      </div>
    </div>
  );
}
