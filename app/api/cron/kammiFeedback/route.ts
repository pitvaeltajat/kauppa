import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseISODate, todayISO, addDays } from '@/lib/kammi';
import { kammiFeedbackEmailsEnabled, trySendEmail, sendKammiFeedbackEmail } from '@/lib/emails';

export const dynamic = 'force-dynamic';

/**
 * Post-stay feedback request, migrated from the old `palaute()` Apps Script.
 * Runs daily (vercel.json): for every CONFIRMED kammi booking that ended in the
 * last few days and hasn't been asked yet, sends the feedback mail once and
 * stamps `feedbackSentAt`. Sending is opt-in via
 * `KAMMI_FEEDBACK_EMAILS_ENABLED=true` while the legacy Google Sheets workflow
 * is still active. The window (not just "ended yesterday") means a missed cron
 * day still catches up without ever double-sending.
 *
 * Vercel Cron calls it with `Authorization: Bearer $CRON_SECRET`. `?dryRun=1`
 * reports who would be mailed without sending.
 */
export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  if (!kammiFeedbackEmailsEnabled()) {
    return NextResponse.json({
      message: 'Kammi feedback emails are disabled',
      due: 0,
      sent: 0,
      recipients: [],
      disabled: true,
    });
  }
  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1';
  const today = todayISO();

  const due = await prisma.kammiBooking.findMany({
    where: {
      status: 'CONFIRMED',
      feedbackSentAt: null,
      email: { not: null },
      endDate: { gt: parseISODate(addDays(today, -7)), lte: parseISODate(today) },
    },
    select: { id: true, email: true },
  });

  let sent = 0;
  for (const booking of due) {
    if (dryRun) continue;
    await trySendEmail(`kammi feedback ${booking.id}`, () => sendKammiFeedbackEmail(booking.id));
    await prisma.kammiBooking.update({
      where: { id: booking.id },
      data: { feedbackSentAt: new Date() },
    });
    sent += 1;
  }

  return NextResponse.json({
    message: 'Kammi feedback sweep completed',
    due: due.length,
    sent: dryRun ? 0 : sent,
    recipients: due.map((b) => b.email),
    dryRun,
  });
}
