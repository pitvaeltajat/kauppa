import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { format } from 'date-fns';
import { fi } from 'date-fns/locale';
import { prisma } from '@/lib/prisma';
import { formatEventDates } from '@/lib/catalog';
import { requireEventAdmin } from '@/lib/admin-guard';
import { Badge } from '@/components/ui/badge';
import { RegistrantEmails } from '@/components/admin/registrant-emails';

export const metadata: Metadata = { title: 'Ilmoittautuneet' };

// A registration is a paid/handed-over order or an issued invoice that contains
// a line for this event. The buyer is the contact; a line quantity > 1 means
// several spots on one order.
type AnswerSnapshot = { prompt?: string; answer?: string | string[] };

function formatAnswer(answer: string | string[] | undefined): string {
  if (Array.isArray(answer)) return answer.join(', ');
  return answer ?? '';
}

export default async function EventRegistrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireEventAdmin();
  const { id } = await params;

  const event = await prisma.item.findUnique({ where: { id } });
  if (!event || !event.isEvent) notFound();

  const orders = await prisma.order.findMany({
    where: {
      lines: { some: { itemId: id } },
      OR: [
        { status: { in: ['PAID', 'COMPLETED'] } },
        { status: 'RECEIVED', stripeInvoiceId: { not: null } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      createdAt: true,
      lines: { where: { itemId: id }, select: { quantity: true, answers: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const rows = orders.map((order) => ({
    id: order.id,
    name: order.name,
    email: order.email,
    status: order.status,
    createdAt: order.createdAt,
    quantity: order.lines.reduce((sum, line) => sum + line.quantity, 0),
    answers: order.lines.flatMap((line) => (line.answers as AnswerSnapshot[] | null) ?? []),
  }));

  const spots = rows.reduce((sum, row) => sum + row.quantity, 0);
  // Unique, non-empty emails preserve first-seen order.
  const emails = [...new Set(rows.map((r) => r.email?.trim()).filter((e): e is string => !!e))];

  return (
    <div>
      <Link
        href="/admin/events"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Tapahtumat
      </Link>
      <h1 className="text-2xl font-bold">{event.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatEventDates(event.startsAt, event.endsAt)} · {rows.length} ilmoittautumista
        {spots !== rows.length && ` · ${spots} paikkaa`}
      </p>

      {rows.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Ei vielä maksettuja tai laskutettuja ilmoittautumisia.
        </p>
      ) : (
        <>
          <div className="mt-6">
            <RegistrantEmails emails={emails} subject={event.name} />
          </div>

          <div className="mt-6 overflow-x-auto rounded-lg border bg-card shadow-sm">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3">Nimi</th>
                  <th className="px-4 py-3">Sähköposti</th>
                  <th className="px-4 py-3 text-right">Paikkoja</th>
                  <th className="px-4 py-3">Lisätiedot</th>
                  <th className="px-4 py-3">Ilmoittautui</th>
                  <th className="px-4 py-3">Tila</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b align-top transition-colors last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium">{row.name ?? 'ei nimeä'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.email ?? 'ei sähköpostia'}</td>
                    <td className="px-4 py-3 text-right">{row.quantity}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.answers.length === 0
                        ? 'ei vastauksia'
                        : row.answers.map((a, i) => (
                            <div key={i}>
                              {a.prompt ? <span className="font-medium">{a.prompt}: </span> : null}
                              {formatAnswer(a.answer)}
                            </div>
                          ))}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(row.createdAt, 'd.M.yyyy', { locale: fi })}
                    </td>
                    <td className="px-4 py-3">
                      {row.status === 'RECEIVED' ? (
                        <Badge variant="warning">Lasku avoinna</Badge>
                      ) : row.status === 'COMPLETED' ? (
                        <Badge variant="success">Luovutettu</Badge>
                      ) : (
                        <Badge variant="success">Maksettu</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
