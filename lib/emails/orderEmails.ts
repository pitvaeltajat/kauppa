import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/money';
import { formatEventDates } from '@/lib/catalog';
import { renderEmail, renderButton, escapeHtml, publicUrl, type EmailContent } from './layout';
import { sendEmail } from './ses-client';

type Answer = { prompt?: string; answer?: string | string[] };

export type OrderEmailData = {
  id: string;
  name: string | null;
  email: string | null;
  totalCents: number;
  notificationEmails?: string[];
  lines: {
    name: string;
    quantity: number;
    priceCents: number;
    imageUrl?: string | null;
    eventDates?: string;
    answers: Answer[];
    participants?: { name: string; answers: Answer[] }[];
  }[];
};

/** "#A1B2C3D4" is the same short id the admin order list shows. */
function orderNumber(id: string): string {
  return `#${id.slice(-8).toUpperCase()}`;
}

function emailImageUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return `${publicUrl()}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
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
    .map((line) => {
      const participantDetails = (line.participants ?? [])
        .map(
          (participant) =>
            `<div class="answers">Osallistuja: ${escapeHtml(participant.name)}${renderAnswers(participant.answers)}</div>`,
        )
        .join('');
      return `
      <tr>
        <td>${line.imageUrl ? `<img src="${escapeHtml(line.imageUrl)}" alt="" width="56" height="56" style="width:56px;height:56px;object-fit:cover;border-radius:6px;vertical-align:middle;margin-right:10px">` : ''}<strong>${escapeHtml(line.name)} × ${line.quantity}</strong>${line.eventDates ? `<br><span style="color:#5A5874">${escapeHtml(line.eventDates)}</span>` : ''}${participantDetails || renderAnswers(line.answers)}</td>
        <td class="num">${formatCents(line.priceCents * line.quantity)}</td>
      </tr>`;
    })
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
  const freeEvent = data.totalCents === 0;
  const html = renderEmail(`
    <h1>${freeEvent ? 'Ilmoittautuminen vastaanotettu' : 'Kiitos tilauksestasi'}</h1>
    <p>${greeting}</p>
    <p>${freeEvent ? `Maksuton tapahtumailmoittautumisesi on vastaanotettu. Ilmoittautumisnumero on <strong>${orderNumber(data.id)}</strong>.` : `Maksusi on vastaanotettu. Tässä on kuitti tilauksestasi <strong>${orderNumber(data.id)}</strong>.`}</p>
    ${renderLinesTable(data)}
    <div class="info-box">
      ${freeEvent ? 'Tapahtumailmoittautuminen on nyt vahvistettu. Saat tapahtuman tarkemmat ohjeet erikseen.' : 'Tuotteet noudetaan kokouksessa ryhmänjohtajalta tai erikseen sovittuna aikana kololta. Emme postita tuotteita. Tapahtumatuotteen ostaminen toimii samalla ilmoittautumisena.'}
    </div>
    ${renderButton(publicUrl(), 'Takaisin Konttiin')}
  `);
  return {
    subject: freeEvent
      ? `Ilmoittautuminen vastaanotettu ${orderNumber(data.id)}`
      : `Kuitti tilauksestasi ${orderNumber(data.id)}`,
    html,
  };
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
      lines: {
        select: {
          name: true,
          quantity: true,
          priceCents: true,
          item: { select: { imageUrl: true, isEvent: true, startsAt: true, endsAt: true } },
          answers: true,
          participants: { select: { name: true, answers: true }, orderBy: { createdAt: 'asc' } },
        },
      },
    },
  });
  if (!order) return null;
  return {
    ...order,
    lines: order.lines.map((line) => ({
      name: line.name,
      quantity: line.quantity,
      priceCents: line.priceCents,
      imageUrl: emailImageUrl(line.item.imageUrl),
      eventDates: line.item.isEvent
        ? formatEventDates(line.item.startsAt, line.item.endsAt)
        : undefined,
      answers: Array.isArray(line.answers) ? (line.answers as Answer[]) : [],
      participants: line.participants.map((participant) => ({
        name: participant.name,
        answers: Array.isArray(participant.answers) ? (participant.answers as Answer[]) : [],
      })),
    })),
    notificationEmails: [],
  };
}

/** Send the buyer their receipt. No-op if the order has no email. */
export async function sendOrderReceiptEmail(orderId: string): Promise<void> {
  const data = await loadOrderEmailData(orderId);
  if (!data?.email) return;
  const { subject, html } = renderOrderReceiptEmail(data);
  await sendEmail(data.email, subject, html);
}

/** Tell the buyer that a payment attempt did not complete. */
export async function sendOrderPaymentFailureEmail(orderId: string): Promise<void> {
  const data = await loadOrderEmailData(orderId);
  if (!data?.email) return;
  const html = renderEmail(`
    <h1>Maksu ei onnistunut</h1>
    <p>Hei${data.name ? ` ${escapeHtml(data.name)}` : ''}!</p>
    <p>Tilauksen <strong>${orderNumber(data.id)}</strong> maksua ei voitu vahvistaa. Maksua ei veloitettu, ja voit yrittää uudelleen.</p>
    ${renderLinesTable(data)}
    ${renderButton(`${publicUrl()}/cart`, 'Palaa ostoskoriin')}
  `);
  await sendEmail(data.email, `Maksu ei onnistunut ${orderNumber(data.id)}`, html);
}

/** Tell a child/parent link recipient that an unpaid event registration was cancelled. */
export async function sendEventCancellationEmail(orderId: string): Promise<void> {
  const data = await loadOrderEmailData(orderId);
  if (!data?.email) return;
  const html = renderEmail(`
    <h1>Ilmoittautuminen peruttu</h1>
    <p>Ilmoittautuminen ${orderNumber(data.id)} on peruttu eikä sitä tarvitse enää maksaa.</p>
    ${renderLinesTable(data)}
    ${renderButton(publicUrl(), 'Avaa PitVa-kontti')}
  `);
  await sendEmail(data.email, `Ilmoittautuminen peruttu ${orderNumber(data.id)}`, html);
}

/** Notify the troop of a new order, if ORDER_NOTIFICATION_EMAILS is set. */
export async function sendNewOrderAdminEmail(orderId: string): Promise<void> {
  const globalRecipients = (process.env.ORDER_NOTIFICATION_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  const data = await loadOrderEmailData(orderId);
  if (!data) return;
  const eventRecipients = await prisma.item.findMany({
    where: { isEvent: true, orderLines: { some: { orderId } } },
    select: { notificationEmails: true },
  });
  const recipients = [
    ...new Set([
      ...globalRecipients,
      ...eventRecipients.flatMap((item) => item.notificationEmails),
    ]),
  ];
  if (recipients.length === 0) return;
  const { subject, html } = renderNewOrderAdminEmail(data);
  await sendEmail(recipients, subject, html);
}

/** Send a child-created event payment link to the parent after signup. */
export async function sendEventPaymentLinkEmail(orderId: string, recipient: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      totalCents: true,
      paymentToken: true,
      lines: {
        select: {
          name: true,
          item: { select: { startsAt: true, endsAt: true } },
          participants: { select: { name: true }, orderBy: { createdAt: 'asc' } },
        },
      },
    },
  });
  if (!order?.paymentToken) return;
  const eventName = order.lines.map((line) => line.name).join(', ');
  const dates = formatEventDates(order.lines[0]?.item.startsAt, order.lines[0]?.item.endsAt);
  const participants = order.lines.flatMap((line) => line.participants.map((p) => p.name));
  const link = `${publicUrl()}/event-payment/${encodeURIComponent(order.paymentToken)}`;
  const html = renderEmail(`
    <h1>Tapahtumamaksu</h1>
    <p>Sinulle on lähetetty maksuohje tapahtumailmoittautumiseen.</p>
    <div class="info-box">
      <strong>${escapeHtml(eventName)}</strong>${dates ? `<br>${escapeHtml(dates)}` : ''}<br>
      ${participants.length ? `Osallistuja: ${escapeHtml(participants.join(', '))}<br>` : ''}
      Hinta: <strong>${formatCents(order.totalCents)}</strong>
    </div>
    <p>Ilmoittautuminen vahvistuu, kun maksu on suoritettu.</p>
    ${renderButton(link, 'Avaa maksuohjeet')}
  `);
  await sendEmail(recipient, `Maksuohje: ${eventName}`, html);
}
