import type { Metadata } from 'next';
import { format } from 'date-fns';
import { fi } from 'date-fns/locale';
import { getStripe } from '@/lib/stripe';
import { formatCents } from '@/lib/money';
import { requireSuperAdmin } from '@/lib/admin-guard';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = { title: 'Tilitykset' };

// Payouts and fees live in Stripe, not our database. We read them live from the
// Payouts + Balance Transactions APIs (not the async Reporting API, which is for
// downloadable accounting CSVs). Each payout is one deposit that lands in Holvi;
// its balance transactions break it down into gross sales, Stripe fees and
// refunds so the treasurer can reconcile the lump-sum deposit.

const STATUS_META: Record<
  string,
  { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' }
> = {
  paid: { label: 'Maksettu', variant: 'success' },
  in_transit: { label: 'Matkalla', variant: 'warning' },
  pending: { label: 'Odottaa', variant: 'warning' },
  canceled: { label: 'Peruttu', variant: 'secondary' },
  failed: { label: 'Epäonnistui', variant: 'destructive' },
};

type PayoutRow = {
  id: string;
  arrivalDate: Date;
  status: string;
  descriptor: string | null;
  grossCents: number;
  feeCents: number;
  refundCents: number;
  netCents: number;
  lines: {
    id: string;
    description: string;
    grossCents: number;
    feeCents: number;
    netCents: number;
  }[];
};

async function loadPayouts(): Promise<
  { ok: true; rows: PayoutRow[] } | { ok: false; error: string }
> {
  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return { ok: false, error: 'Stripe ei ole konfiguroitu (aseta STRIPE_SECRET_KEY).' };
  }

  try {
    const payouts = await stripe.payouts.list({ limit: 12 });
    const rows = await Promise.all(
      payouts.data.map(async (p): Promise<PayoutRow> => {
        // Transactions settled by this payout (the payout entry itself excluded).
        const txns = await stripe.balanceTransactions.list({ payout: p.id, limit: 100 });
        let grossCents = 0;
        let feeCents = 0;
        let refundCents = 0;
        const lines: PayoutRow['lines'] = [];
        for (const t of txns.data) {
          if (t.type === 'payout') continue;
          feeCents += t.fee;
          if (t.amount >= 0) grossCents += t.amount;
          else refundCents += -t.amount;
          lines.push({
            id: t.id,
            description: t.description ?? t.reporting_category ?? t.type,
            grossCents: t.amount,
            feeCents: t.fee,
            netCents: t.net,
          });
        }
        return {
          id: p.id,
          arrivalDate: new Date(p.arrival_date * 1000),
          status: p.status,
          descriptor: p.statement_descriptor,
          grossCents,
          feeCents,
          refundCents,
          netCents: p.amount,
          lines,
        };
      }),
    );
    return { ok: true, rows };
  } catch (err) {
    console.error('Tilitysten haku Stripestä epäonnistui:', err);
    return { ok: false, error: 'Tilitysten haku Stripestä epäonnistui.' };
  }
}

export default async function AdminPayoutsPage() {
  await requireSuperAdmin();
  const result = await loadPayouts();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Tilitykset</h1>
        <div className="text-sm text-muted-foreground">Stripen maksut pankkitilille (Holvi)</div>
      </div>

      {!result.ok ? (
        <p className="rounded-lg border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          {result.error}
        </p>
      ) : result.rows.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Ei tilityksiä. Testitilassa Stripe ei maksa tilityksiä pankkitilille.
        </p>
      ) : (
        <div className="space-y-3">
          {result.rows.map((payout) => (
            <div key={payout.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <p className="font-semibold">
                    {format(payout.arrivalDate, 'd.M.yyyy', { locale: fi })}
                    {payout.descriptor && (
                      <span className="ml-2 font-normal text-muted-foreground">
                        {payout.descriptor}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    Brutto {formatCents(payout.grossCents)} · kulut {formatCents(payout.feeCents)}
                    {payout.refundCents > 0 && (
                      <> · palautukset {formatCents(payout.refundCents)}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={STATUS_META[payout.status]?.variant ?? 'secondary'}>
                    {STATUS_META[payout.status]?.label ?? payout.status}
                  </Badge>
                  <span className="font-bold">{formatCents(payout.netCents)}</span>
                </div>
              </div>

              {payout.lines.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    Tapahtumat ({payout.lines.length})
                  </summary>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <th className="py-1 pr-3 font-medium">Tapahtuma</th>
                          <th className="py-1 px-3 text-right font-medium">Brutto</th>
                          <th className="py-1 px-3 text-right font-medium">Kulu</th>
                          <th className="py-1 pl-3 text-right font-medium">Netto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payout.lines.map((line) => (
                          <tr key={line.id} className="border-b last:border-0">
                            <td className="py-1 pr-3">{line.description}</td>
                            <td className="py-1 px-3 text-right text-muted-foreground">
                              {formatCents(line.grossCents)}
                            </td>
                            <td className="py-1 px-3 text-right text-muted-foreground">
                              {formatCents(line.feeCents)}
                            </td>
                            <td className="py-1 pl-3 text-right font-medium">
                              {formatCents(line.netCents)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
