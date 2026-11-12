import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendKammiPaymentReminderEmail, trySendEmail } from '@/lib/emails';

export const dynamic = 'force-dynamic';

/** Send one reminder after three days and a final reminder after fourteen days. */
export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  const now = Date.now();
  const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
  const due = await prisma.kammiBooking.findMany({
    where: {
      status: 'PENDING',
      paymentToken: { not: null },
      OR: [
        { paymentReminderCount: 0, createdAt: { lte: threeDaysAgo } },
        { paymentReminderCount: 1, createdAt: { lte: fourteenDaysAgo } },
      ],
    },
    select: { id: true, paymentReminderCount: true },
  });

  let sent = 0;
  for (const booking of due) {
    const reminderNumber = booking.paymentReminderCount + 1;
    const claimed = await prisma.kammiBooking.updateMany({
      where: {
        id: booking.id,
        status: 'PENDING',
        paymentReminderCount: booking.paymentReminderCount,
      },
      data: { paymentReminderCount: reminderNumber },
    });
    if (claimed.count !== 1) continue;
    await trySendEmail(`kammi payment reminder ${booking.id}`, () =>
      sendKammiPaymentReminderEmail(booking.id, reminderNumber),
    );
    sent += 1;
  }

  return NextResponse.json({ due: due.length, sent });
}
