import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/money';
import { formatEventDates, isEventOver } from '@/lib/catalog';
import { setEventHidden } from '@/lib/actions/admin';
import { requireEventAdmin } from '@/lib/admin-guard';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { FormButton } from '@/components/admin/form-button';
import { lowestVariantPrice } from '@/lib/catalog';

export const metadata: Metadata = { title: 'Tapahtumat' };

export default async function AdminEventsPage() {
  await requireEventAdmin();
  const events = await prisma.item.findMany({
    where: { isEvent: true },
    orderBy: [{ startsAt: 'desc' }, { name: 'asc' }],
    include: {
      // Paid/handed-over orders plus issued-but-unpaid invoices are registrations.
      // Count participants, falling back to line quantity for pre-migration rows.
      orderLines: {
        where: {
          order: {
            OR: [
              { status: { in: ['PAID', 'COMPLETED'] } },
              { status: 'RECEIVED', stripeInvoiceId: { not: null } },
            ],
          },
        },
        select: { quantity: true, participants: { select: { id: true } } },
      },
      variants: { where: { active: true }, select: { priceCents: true } },
    },
  });

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Tapahtumat ({events.length})</h1>
        <ButtonLink href="/admin/events/new" variant="cta">
          <Plus /> Uusi tapahtuma
        </ButtonLink>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Tapahtuman ostaminen toimii ilmoittautumisena. Tapahtuma poistuu etusivulta automaattisesti
        viikon kuluttua päättymisestä, mutta siihen pääsee edelleen suoralla linkillä.
      </p>

      {events.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Tapahtumia ei ole vielä. Luo ensimmäinen tapahtuma Uusi tapahtuma -painikkeella.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3">Tapahtuma</th>
                <th className="px-4 py-3">Ajankohta</th>
                <th className="px-4 py-3 text-right">Hinta</th>
                <th className="px-4 py-3">Tila</th>
                <th className="px-4 py-3 text-right">Toiminnot</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const over = isEventOver(event.endsAt);
                const participantCount = event.orderLines.reduce(
                  (sum, line) => sum + (line.participants.length || line.quantity),
                  0,
                );
                return (
                  <tr
                    key={event.id}
                    className="border-b transition-colors last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/${event.slug}`}
                        className="hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {event.name}
                        <span className="ml-1 text-xs text-muted-foreground">↗</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatEventDates(event.startsAt, event.endsAt) || 'ei päivää'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCents(lowestVariantPrice(event.variants))}
                    </td>
                    <td className="px-4 py-3">
                      {!event.active ? (
                        <Badge variant="secondary">Ei myynnissä</Badge>
                      ) : event.hidden ? (
                        <Badge variant="secondary">Piilotettu</Badge>
                      ) : over ? (
                        <Badge variant="warning">Päättynyt</Badge>
                      ) : (
                        <Badge variant="success">Näkyvissä</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <ButtonLink
                          href={`/admin/events/${event.id}/registrants`}
                          size="sm"
                          variant="outline"
                        >
                          Ilmoittautuneet ({participantCount})
                        </ButtonLink>
                        <ButtonLink href={`/admin/events/${event.id}`} size="sm" variant="outline">
                          Muokkaa
                        </ButtonLink>
                        <form action={setEventHidden}>
                          <input type="hidden" name="id" value={event.id} />
                          <input
                            type="hidden"
                            name="hidden"
                            value={event.hidden ? 'false' : 'true'}
                          />
                          <FormButton size="sm" variant="ghost">
                            {event.hidden ? 'Näytä' : 'Piilota'}
                          </FormButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
