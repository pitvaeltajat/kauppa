import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/money';
import { toISODate } from '@/lib/kammi';
import { renderEmail, renderButton, escapeHtml, publicUrl, type EmailContent } from './layout';
import { sendEmail } from './ses-client';

/** Where the post-stay feedback form lives (kept from the old automation). */
const FEEDBACK_URL = () => process.env.KAMMI_FEEDBACK_URL || 'https://bit.ly/kamminpalautelomake';
/** The cabin host who fields booking questions and signs the feedback mail. */
const HOST_EMAIL = () => process.env.KAMMI_HOST_EMAIL || 'paavali.keppo@pitkajarvenvaeltajat.fi';
const HOST_SIGNATURE = `Terveisin,<br>Paavali Keppo<br>Kämppäisäntä<br>Pitkäjärven Vaeltajat ry<br>044 9747446<br>paavali.keppo@pitkajarvenvaeltajat.fi`;

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
    <p>Varauksesi on vahvistettu ja maksu on vastaanotettu. Kammi on varattu sinulle:</p>
    <div class="info-box">
      <strong>${fi(data.startISO)} – ${fi(data.endISO)}</strong> (${data.nights} yötä)<br>
      Hinta: ${formatCents(data.totalCents)}
    </div>
    ${keycodeBlock}
    ${instructionsBlock}
    <p>Muistathan loppusiivouksen. Jos siivous jää tekemättä, siitä veloitetaan erikseen.</p>
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

/** Send the payer a confirmation when the payer differs from the booker. */
export async function sendKammiPayerReceiptEmail(bookingId: string): Promise<void> {
  const [booking] = await Promise.all([
    prisma.kammiBooking.findUnique({ where: { id: bookingId } }),
  ]);
  if (!booking?.billingEmail || booking.billingEmail === booking.email) return;
  const html = renderEmail(`
    <h1>Kammin maksu vastaanotettu</h1>
    <p>Kammin varaus on maksettu. Varaaja saa erillisen varausvahvistuksen ja ovikoodin.</p>
    <div class="info-box"><strong>${fi(toISODate(booking.startDate))} – ${fi(toISODate(booking.endDate))}</strong> (${booking.nights} yötä)<br>Hinta: ${formatCents(booking.totalCents)}<br>Varaaja: ${escapeHtml(booking.name ?? 'Varaaja')}</div>
    ${renderButton(publicUrl(), 'Pitkäjärven Vaeltajat')}
  `);
  await sendEmail(
    booking.billingEmail,
    `Kammin maksu vastaanotettu ${fi(toISODate(booking.startDate))}`,
    html,
  );
}

async function kammiRecipients(bookingId: string): Promise<{
  booking: KammiEmailData & {
    email: string | null;
    billingEmail: string | null;
    paymentToken: string | null;
  };
} | null> {
  const [booking, settings] = await Promise.all([
    prisma.kammiBooking.findUnique({ where: { id: bookingId } }),
    prisma.kammiSettings.findUnique({ where: { id: 'singleton' } }),
  ]);
  if (!booking) return null;
  return {
    booking: {
      name: booking.name,
      startISO: toISODate(booking.startDate),
      endISO: toISODate(booking.endDate),
      nights: booking.nights,
      totalCents: booking.totalCents,
      keycode: settings?.keycode ?? '',
      instructions: settings?.instructions ?? '',
      email: booking.email,
      billingEmail: booking.billingEmail,
      paymentToken: booking.paymentToken,
    },
  };
}

/** Notify recipients when a Kammi booking is cancelled. */
export async function sendKammiCancellationEmail(bookingId: string): Promise<void> {
  const data = await kammiRecipients(bookingId);
  if (!data) return;
  const recipients = [
    ...new Set([data.booking.email, data.booking.billingEmail].filter(Boolean)),
  ] as string[];
  if (!recipients.length) return;
  const html = renderEmail(`
    <h1>Kammin varaus peruttu</h1>
    <p>Kammin varaus on peruttu ja päivät on vapautettu.</p>
    <div class="info-box"><strong>${data.booking.startISO} – ${data.booking.endISO}</strong> (${data.booking.nights} yötä)<br>Hinta: ${formatCents(data.booking.totalCents)}</div>
    ${renderButton(publicUrl(), 'Avaa PitVa-kontti')}
  `);
  await sendEmail(recipients, `Kammin varaus peruttu ${data.booking.startISO}`, html);
}

/** Remind a payer/booker about a still-unpaid, indefinite hold. */
export async function sendKammiPaymentReminderEmail(
  bookingId: string,
  reminderNumber: number,
): Promise<void> {
  const data = await kammiRecipients(bookingId);
  if (!data) return;
  const recipients = [
    ...new Set([data.booking.billingEmail, data.booking.email].filter(Boolean)),
  ] as string[];
  if (!recipients.length || !data.booking.paymentToken) return;
  const html = renderEmail(`
    <h1>Muistutus: Kammin maksu odottaa</h1>
    <p>Kammin varaus on edelleen pidossa, mutta maksua ei ole vielä vahvistettu.</p>
    <div class="info-box"><strong>${data.booking.startISO} – ${data.booking.endISO}</strong> (${data.booking.nights} yötä)<br>Hinta: ${formatCents(data.booking.totalCents)}</div>
    <p>Varaus pysyy voimassa, kunnes se maksetaan tai ylläpito peruu sen.</p>
    ${renderButton(`${publicUrl()}/kammi/pay/${encodeURIComponent(data.booking.paymentToken)}`, reminderNumber > 1 ? 'Maksa Kammin varaus nyt' : 'Avaa maksuohje')}
  `);
  await sendEmail(recipients, `Muistutus: Kammin maksu ${data.booking.startISO}`, html);
}

/**
 * Post-stay feedback request, migrated from the old `palaute()` Apps Script.
 * Sent the day a stay ends, asking the booker to fill the feedback form.
 */
export function renderKammiFeedbackEmail(name: string | null): EmailContent {
  const greeting = name ? `Moi ${escapeHtml(name)}!` : 'Moi!';
  const html = renderEmail(`
    <h1>Kiitos vierailustasi Kammilla</h1>
    <p>${greeting}</p>
    <p>
      Kiitos vierailustasi Kammilla. Toivottavasti retki sujui hyvin! Kerro kokemuksestasi
      täyttämällä Kammin palautelomake. Vastaamiseen menee vain hetki, ja lomake toimii myös
      puhelimella.
    </p>
    ${renderButton(FEEDBACK_URL(), 'Täytä palautelomake')}
    <p>Kiitos palautteestasi jo etukäteen!</p>
    <p>${HOST_SIGNATURE}</p>
  `);
  return { subject: 'Kammin palautelomake', html };
}

export async function sendKammiFeedbackEmail(bookingId: string): Promise<void> {
  const booking = await prisma.kammiBooking.findUnique({ where: { id: bookingId } });
  if (!booking?.email) return;
  const { subject, html } = renderKammiFeedbackEmail(booking.name);
  await sendEmail(booking.email, subject, html);
}

/** Notify the cabin host of a new confirmed booking, with all the details. */
export async function sendKammiHostNotificationEmail(bookingId: string): Promise<void> {
  const to = HOST_EMAIL();
  if (!to) return;
  const booking = await prisma.kammiBooking.findUnique({ where: { id: bookingId } });
  if (!booking) return;
  const rows: [string, string | null][] = [
    ['Varaaja', booking.name],
    ['Yhteisö tai seura', booking.organization],
    ['Sähköposti', booking.email],
    ['Puhelin', booking.phone],
    ['Laskutus', booking.billingEmail],
    ['Hinnan peruste', booking.tier === 'SCOUT' ? 'Partiolainen' : 'Muu varaaja'],
    ['Tapahtuman tiedot', booking.eventInfo],
    ['Kysymykset', booking.hostQuestions],
  ];
  const rowsHtml = rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 10px 4px 0;color:#5A5874">${k}</td><td style="padding:4px 0;color:#221E5D">${escapeHtml(v ?? '')}</td></tr>`,
    )
    .join('');
  const { subject, html } = {
    subject: `Uusi Kammi-varaus ${fi(toISODate(booking.startDate))}–${fi(toISODate(booking.endDate))}`,
    html: renderEmail(`
      <h1>Uusi Kammin varaus</h1>
      <div class="info-box"><strong>${fi(toISODate(booking.startDate))} – ${fi(toISODate(booking.endDate))}</strong> (${booking.nights} yötä) · ${formatCents(booking.totalCents)}</div>
      <table>${rowsHtml}</table>
      ${renderButton(`${publicUrl()}/admin/kammi`, 'Avaa hallinta')}
    `),
  };
  await sendEmail(to, subject, html);
}
