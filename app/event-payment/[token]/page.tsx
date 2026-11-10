import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/money';
import { formatEventDates } from '@/lib/catalog';
import { EventPayment } from '@/components/event-payment';

export const metadata: Metadata = { title: 'Tapahtumamaksu' };

export default async function EventPaymentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const order = await prisma.order.findUnique({
    where: { paymentToken: token },
    include: {
      lines: {
        include: {
          item: { select: { isEvent: true, startsAt: true, endsAt: true } },
          participants: { select: { name: true }, orderBy: { createdAt: 'asc' } },
        },
      },
    },
  });
  if (!order || !order.lines.length || order.lines.some((line) => !line.item.isEvent)) notFound();

  const event = order.lines[0].item;
  const eventName = order.lines.map((line) => line.name).join(', ');
  const dates = formatEventDates(event.startsAt, event.endsAt);
  const participants = order.lines.flatMap((line) => line.participants.map((p) => p.name));

  return (
    <EventPayment
      token={token}
      eventName={eventName}
      dates={dates}
      participants={participants}
      total={formatCents(order.totalCents)}
      status={order.status}
    />
  );
}
