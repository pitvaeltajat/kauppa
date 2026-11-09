import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/money';
import { renderEmail, renderButton, escapeHtml, publicUrl, type EmailContent } from './layout';
import { sendEmail } from './ses-client';

type Answer = { prompt?: string; answer?: string | string[] };

export type OrderEmailData = {
  id: string;
  name: string | null;
  email: string | null;
  totalCents: number;
  lines: { name: string; quantity: number; priceCents: number; answers: Answer[] }[];
};

/** "#A1B2C3D4" is the same short id the admin order list shows. */
function orderNumber(id: string): string {
  return `#${id.slice(-8).toUpperCase()}`;
}

function renderAnswers(answers: Answer[]): string {
  const parts = answers
    .filter((a) => a.answer !== undefined && a.answer !== '')
    .map((a) => {
      const value = Array.isArray(a.answer) ? a.answer.join(', ') : (a.answer ?? '');
      const prompt = a.prompt ? `${escapeHtml(a.prompt)}: ` : '';
      return `${prompt}${escapeHtml(value)}`;
    });
  return parts.length ? `<div class="answers">${parts.join('<br>')}</div>` : '';
}

function renderLinesTable(data: OrderEmailData): string {
  const rows = data.lines
    .map(
      (line) => `
      <tr>
        <td>${escapeHtml(line.name)} × ${line.quantity}${renderAnswers(line.answers)}</td>
        <td class="num">${formatCents(line.priceCents * line.quantity)}</td>
      </tr>`,
    )
    .join('');
  return `
    <table class="lines">
      <thead><tr><th>Tuote</th><th class="num">Yhteensä</th></tr></thead>
      <tbody>
        ${rows}
        <tr class="total-row"><td>Yhteensä</td><td class="num">${formatCents(data.totalCents)}</td></tr>
      </tbody>
    </table>`;
}

/** Receipt the buyer gets once a payment is confirmed. */
export function renderOrderReceiptEmail(data: OrderEmailData): EmailContent {
  const greeting = data.name ? `Hei ${escapeHtml(data.name)}!` : 'Hei!';
  const html = renderEmail(`
    <h1>Kiitos tilauksestasi</h1>
    <p>${greeting}</p>
    <p>Maksusi on vastaanotettu. Tässä on kuitti tilauksestasi <strong>${orderNumber(data.id)}</strong>.</p>
    ${renderLinesTable(data)}
    <div class="info-box">
      Tuotteet noudetaan kokouksessa ryhmänjohtajalta tai erikseen sovittuna aikana kololta.
      Emme postita tuotteita. Tapahtumatuotteen ostaminen toimii samalla ilmoittautumisena.
    </div>
    ${renderButton(publicUrl(), 'Takaisin Konttiin')}
  `);
  return { subject: `Kuitti tilauksestasi ${orderNumber(data.id)}`, html };
}

/** Heads-up to the troop when a new order is paid. */
export function renderNewOrderAdminEmail(data: OrderEmailData): EmailContent {
  const buyer = [data.name, data.email].filter(Boolean).join(' · ') || 'Yhteystietoja ei annettu';
  const html = renderEmail(`
    <h1>Uusi tilaus ${orderNumber(data.id)}</h1>
    <p>${escapeHtml(buyer)}</p>
    ${renderLinesTable(data)}
    ${renderButton(`${publicUrl()}/admin`, 'Avaa hallinta')}
  `);
  return { subject: `Uusi tilaus ${orderNumber(data.id)}`, html };
}

async function loadOrderEmailData(orderId: string): Promise<OrderEmailData | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      name: true,
      email: true,
      totalCents: true,
      lines: { select: { name: true, quantity: true, priceCents: true, answers: true } },
    },
  });
  if (!order) return null;
  return {
    ...order,
    lines: order.lines.map((line) => ({
      name: line.name,
      quantity: line.quantity,
      priceCents: line.priceCents,
      answers: Array.isArray(line.answers) ? (line.answers as Answer[]) : [],
    })),
  };
}

/** Send the buyer their receipt. No-op if the order has no email. */
export async function sendOrderReceiptEmail(orderId: string): Promise<void> {
  const data = await loadOrderEmailData(orderId);
  if (!data?.email) return;
  const { subject, html } = renderOrderReceiptEmail(data);
  await sendEmail(data.email, subject, html);
}

/** Notify the troop of a new order, if ORDER_NOTIFICATION_EMAILS is set. */
export async function sendNewOrderAdminEmail(orderId: string): Promise<void> {
  const recipients = (process.env.ORDER_NOTIFICATION_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  if (recipients.length === 0) return;
  const data = await loadOrderEmailData(orderId);
  if (!data) return;
  const { subject, html } = renderNewOrderAdminEmail(data);
  await sendEmail(recipients, subject, html);
}
