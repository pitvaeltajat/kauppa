import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/money';
import { toISODate } from '@/lib/kammi';
import { KammiPayment } from '@/components/kammi-payment';

export const metadata: Metadata = { title: 'Kammin maksu' };

export default async function KammiPaymentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const booking = await prisma.kammiBooking.findUnique({ where: { paymentToken: token } });
  if (!booking) notFound();
  return <KammiPayment token={token} name={booking.name ?? 'Varaus'} start={toISODate(booking.startDate)} end={toISODate(booking.endDate)} nights={booking.nights} total={formatCents(booking.totalCents)} />;
}
