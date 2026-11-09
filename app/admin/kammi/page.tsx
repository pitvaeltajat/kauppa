import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/money';
import { toISODate } from '@/lib/kammi';
import { requireSuperAdmin } from '@/lib/admin-guard';
import { getKammiSettings } from '@/lib/kammiBookings';
import { cancelKammiBookingAction } from '@/lib/actions/kammi';
import { Badge } from '@/components/ui/badge';
import { FormButton } from '@/components/admin/form-button';
import { KammiSettingsForm } from '@/components/admin/kammi-settings-form';

export const metadata: Metadata = { title: 'Kammi' };

function fi(d: Date): string {
  const [y, m, day] = toISODate(d).split('-');
  return `${Number(day)}.${Number(m)}.${y}`;
}

export default async function AdminKammiPage() {
  await requireSuperAdmin();
  const [settings, bookings] = await Promise.all([
    getKammiSettings(),
    prisma.kammiBooking.findMany({
      where: { status: { not: 'CANCELLED' } },
      orderBy: { startDate: 'desc' },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="mb-4 text-2xl font-bold">Kammi-varaukset ({bookings.length})</h1>
        {bookings.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            Ei varauksia vielä.
          </p>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => (
              <div key={b.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card p-4 shadow-sm">
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">
                    {fi(b.startDate)} – {fi(b.endDate)}
                      <span className="ml-2 font-normal text-muted-foreground">{b.nights} yötä · {b.tier === 'SCOUT' ? 'Partiolainen' : 'Muu varaaja'}</span>
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    {b.name ?? 'Ei nimeä'}
                    {b.organization ? ` · ${b.organization}` : ''}
                    {b.email ? ` · ${b.email}` : ''}
                    {b.phone ? ` · ${b.phone}` : ''}
                  </p>
                  {b.eventInfo && <p className="mt-1 text-muted-foreground">{b.eventInfo}</p>}
                  {b.hostQuestions && (
                    <p className="mt-1 text-muted-foreground">
                      <span className="font-medium text-foreground">Viesti kämppäisännälle:</span> {b.hostQuestions}
                    </p>
                  )}
                  {b.billingEmail && (
                    <p className="mt-1 text-xs text-muted-foreground">Laskutus: {b.billingEmail}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {b.status === 'CONFIRMED' ? (
                    <Badge variant="success">Vahvistettu</Badge>
                  ) : (
                    <Badge variant="warning">Maksu odottaa</Badge>
                  )}
                  <span className="font-bold">{formatCents(b.totalCents)}</span>
                  <form action={cancelKammiBookingAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <FormButton
                      size="sm"
                      variant="ghost"
                      confirm={`Perutaanko varaus ${fi(b.startDate)}–${fi(b.endDate)}? Päivät vapautuvat.`}
                    >
                      Peru
                    </FormButton>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-4 text-xl font-bold">Asetukset</h2>
        <KammiSettingsForm settings={settings} />
      </div>
    </div>
  );
}
