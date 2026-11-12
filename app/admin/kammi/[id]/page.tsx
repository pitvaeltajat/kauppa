import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/money';
import { toISODate } from '@/lib/kammi';
import { requireSuperAdmin } from '@/lib/admin-guard';
import { cancelKammiBookingAction } from '@/lib/actions/kammi';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { FormButton } from '@/components/admin/form-button';

export const metadata: Metadata = { title: 'Kammin varaus' };

function fi(d: Date): string {
  const [y, m, day] = toISODate(d).split('-');
  return `${Number(day)}.${Number(m)}.${y}`;
}

export default async function AdminKammiBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id } = await params;
  const booking = await prisma.kammiBooking.findUnique({ where: { id } });
  if (!booking) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Kammin varaus</p>
          <h1 className="text-2xl font-bold">
            {fi(booking.startDate)} – {fi(booking.endDate)}
          </h1>
        </div>
        <ButtonLink href="/admin/kammi" variant="outline">
          Takaisin varauskalenteriin
        </ButtonLink>
      </div>

      <div className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div className="flex items-center gap-2">
            {booking.status === 'CONFIRMED' ? (
              <Badge variant="success">Vahvistettu</Badge>
            ) : booking.status === 'CANCELLED' ? (
              <Badge variant="outline">Peruttu</Badge>
            ) : (
              <Badge variant="warning">Maksu odottaa</Badge>
            )}
            <span className="text-sm text-muted-foreground">
              {booking.nights} yötä · {booking.tier === 'SCOUT' ? 'Partiolainen' : 'Muu varaaja'}
            </span>
          </div>
          <span className="text-lg font-bold">{formatCents(booking.totalCents)}</span>
        </div>

        <dl className="grid gap-x-6 gap-y-4 pt-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Varaaja</dt>
            <dd className="font-medium">{booking.name ?? 'Ei nimeä'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Sähköposti</dt>
            <dd>{booking.email ?? '–'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Puhelin</dt>
            <dd>{booking.phone ?? '–'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Organisaatio</dt>
            <dd>{booking.organization ?? '–'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Laskutussähköposti</dt>
            <dd>{booking.billingEmail ?? '–'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Luotu</dt>
            <dd>{fi(booking.createdAt)}</dd>
          </div>
        </dl>

        {booking.eventInfo && (
          <p className="mt-5 border-t pt-4 text-sm">
            <span className="font-medium">Tapahtuman tiedot:</span> {booking.eventInfo}
          </p>
        )}
        {booking.hostQuestions && (
          <p className="mt-3 text-sm">
            <span className="font-medium">Viesti kämppäisännälle:</span> {booking.hostQuestions}
          </p>
        )}

        {booking.status !== 'CANCELLED' && (
          <div className="mt-6 border-t pt-4">
            <form action={cancelKammiBookingAction}>
              <input type="hidden" name="id" value={booking.id} />
              <FormButton
                variant="ghost"
                confirm={`Perutaanko varaus ${fi(booking.startDate)}–${fi(booking.endDate)}? Päivät vapautuvat.`}
              >
                Peru varaus
              </FormButton>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
