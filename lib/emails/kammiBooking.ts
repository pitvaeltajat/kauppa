import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/money';
import { toISODate } from '@/lib/kammi';
import { renderEmail, renderButton, escapeHtml, publicUrl, type EmailContent } from './layout';
import { sendEmail } from './ses-client';

export type KammiEmailData = {
  name: string | null;
  startISO: string;
  endISO: string;
  nights: number;
  totalCents: number;
  keycode: string;
  instructions: string;
};

/** 'YYYY-MM-DD' → 'D.M.YYYY' (Finnish date). */
function fi(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${Number(d)}.${Number(m)}.${y}`;
}

export function renderKammiConfirmationEmail(data: KammiEmailData): EmailContent {
  const greeting = data.name ? `Hei ${escapeHtml(data.name)}!` : 'Hei!';
  const keycodeBlock = data.keycode
    ? `<div class="info-box"><strong>Ovikoodi:</strong> ${escapeHtml(data.keycode)}</div>`
    : '';
  const instructionsBlock = data.instructions
    ? `<h2>Ohjeet</h2><p style="white-space:pre-line">${escapeHtml(data.instructions)}</p>`
    : '';
  const html = renderEmail(`
    <h1>Kammi-varaus vahvistettu</h1>
    <p>${greeting}</p>
    <p>Varauksesi on vahvistettu ja maksettu. Kammi on varattu sinulle:</p>
    <div class="info-box">
      <strong>${fi(data.startISO)} – ${fi(data.endISO)}</strong> (${data.nights} yötä)<br>
      Maksettu: ${formatCents(data.totalCents)}
    </div>
    ${keycodeBlock}
    ${instructionsBlock}
    <p>Muistathan loppusiivouksen — tekemättä jätetystä siivouksesta veloitetaan erikseen.</p>
    ${renderButton(publicUrl(), 'Pitkäjärven Vaeltajat')}
  `);
  return { subject: `Kammi-varaus vahvistettu ${fi(data.startISO)}–${fi(data.endISO)}`, html };
}

/** Send the confirmation (keycode + instructions) to the booker. */
export async function sendKammiConfirmationEmail(bookingId: string): Promise<void> {
  const [booking, settings] = await Promise.all([
    prisma.kammiBooking.findUnique({ where: { id: bookingId } }),
    prisma.kammiSettings.findUnique({ where: { id: 'singleton' } }),
  ]);
  if (!booking?.email) return;
  const { subject, html } = renderKammiConfirmationEmail({
    name: booking.name,
    startISO: toISODate(booking.startDate),
    endISO: toISODate(booking.endDate),
    nights: booking.nights,
    totalCents: booking.totalCents,
    keycode: settings?.keycode ?? '',
    instructions: settings?.instructions ?? '',
  });
  await sendEmail(booking.email, subject, html);
}
