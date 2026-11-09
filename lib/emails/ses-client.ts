import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

// Mirrors klapi's utils/emails/ses-client.ts. In local dev (USE_LOCAL_SES=true)
// it points at aws-ses-v2-local so no real mail is sent; in production it uses
// the KAUPPA_AWS_* credentials. kontti sends from its own verified identity but
// via the same AWS account/region klapi uses.
const isLocal = process.env.USE_LOCAL_SES === 'true';

const ses = new SESClient({
  region: process.env.KAUPPA_AWS_REGION || 'eu-north-1',
  ...(isLocal
    ? {
        endpoint: 'http://localhost:8005',
        credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
      }
    : {
        credentials: {
          accessKeyId: process.env.KAUPPA_AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.KAUPPA_AWS_SECRET_ACCESS_KEY || '',
        },
      }),
});

/** Every kontti mail subject carries this tag, applied in one place. */
export const SUBJECT_PREFIX = '[PitVa-kontti] ';

export async function sendEmail(to: string | string[], subject: string, html: string) {
  const toAddresses = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (toAddresses.length === 0) return;

  const from = process.env.KAUPPA_SES_FROM_EMAIL || process.env.AWS_SES_FROM_EMAIL;
  if (!from) throw new Error('KAUPPA_SES_FROM_EMAIL is not set');

  const taggedSubject = subject.startsWith(SUBJECT_PREFIX) ? subject : `${SUBJECT_PREFIX}${subject}`;

  const command = new SendEmailCommand({
    Destination: { ToAddresses: toAddresses },
    Message: {
      Body: { Html: { Charset: 'UTF-8', Data: html } },
      Subject: { Charset: 'UTF-8', Data: taggedSubject },
    },
    Source: from,
  });
  return ses.send(command);
}
