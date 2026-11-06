import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/money';
import { formatEventDates, isEventOver } from '@/lib/catalog';
import { setEventHidden } from '@/lib/actions/admin';
import { requireEventAdmin } from '@/lib/admin-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Tapahtumat' };

export default async function AdminEventsPage() {
  await requireEventAdmin();
  const events = await prisma.item.findMany({
    where: { isEvent: true },
    orderBy: [{ startsAt: 'desc' }, { name: 'asc' }],
    include: {
      // Paid/handed-over order lines ≈ registrations (one line per order per event).
      _count: {
        select: { orderLines: { where: { order: { status: { in: ['PAID', 'COMPLETED'] } } } } },
      },
    },
  });

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tapahtumat ({events.length})</h1>
        <Link href="/admin/events/new">
          <Button variant="cta">
            <Plus /> Uusi tapahtuma
          </Button>
        </Link>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Tapahtuman ostaminen on ilmoittautuminen. Tapahtuma poistuu etusivulta automaattisesti
        viikko päättymispäivän jälkeen, mutta pysyy avoinna suoralla linkillä.
      </p>

      {events.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Ei tapahtumia vielä. Luo ensimmäinen “Uusi tapahtuma” -painikkeella.
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
                return (
                  <tr key={event.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/item/${event.slug}`}
                        className="hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {event.name}
                        <span className="ml-1 text-xs text-muted-foreground">↗</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatEventDates(event.startsAt, event.endsAt) || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">{formatCents(event.priceCents)}</td>
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
                        <Link href={`/admin/events/${event.id}/ilmoittautuneet`}>
                          <Button type="button" size="sm" variant="outline">
                            Ilmoittautuneet ({event._count.orderLines})
                          </Button>
                        </Link>
                        <Link href={`/admin/events/${event.id}`}>
                          <Button type="button" size="sm" variant="outline">
                            Muokkaa
                          </Button>
                        </Link>
                        <form action={setEventHidden}>
                          <input type="hidden" name="id" value={event.id} />
                          <input type="hidden" name="hidden" value={event.hidden ? 'false' : 'true'} />
                          <Button type="submit" size="sm" variant="ghost">
                            {event.hidden ? 'Näytä' : 'Piilota'}
                          </Button>
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
