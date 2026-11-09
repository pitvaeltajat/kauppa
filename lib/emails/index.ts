/**
 * Every outgoing email lives here (mirrors klapi's utils/emails/): one module
 * holds a pure `render*Email` plus a `send*Email` that loads the data and hands
 * it to SES. Callers import the senders from here and wrap them in
 * `trySendEmail` so a flaky send never breaks the request that triggered it.
 */
export {
  renderOrderReceiptEmail,
  sendOrderReceiptEmail,
  renderNewOrderAdminEmail,
  sendNewOrderAdminEmail,
  type OrderEmailData,
} from './orderEmails';
export {
  renderKammiConfirmationEmail,
  sendKammiConfirmationEmail,
  renderKammiFeedbackEmail,
  sendKammiFeedbackEmail,
  sendKammiHostNotificationEmail,
  type KammiEmailData,
} from './kammiBooking';
export { SUBJECT_PREFIX } from './ses-client';
export type { EmailContent } from './layout';

/**
 * Run one email send, logging and swallowing failures. The webhook that marks
 * an order paid must still return 200 even if SES is down, or Stripe will retry
 * the whole payment handler. Same shape as klapi's trySendEmail.
 */
export async function trySendEmail(label: string, send: () => Promise<void>): Promise<void> {
  try {
    await send();
    console.log(`Sent ${label}`);
  } catch (error) {
    console.error(`Error sending ${label}:`, error);
  }
}
