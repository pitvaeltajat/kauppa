// Render the shop's emails to HTML files without sending. This is the quick way to
// eyeball a template. Mirrors klapi's scripts/preview-emails.ts.
//
//   pnpm tsx scripts/preview-emails.ts [outDir]
//
// Writes receipt.html + new-order.html to outDir (default: ./email-previews).
// If TEST_EMAIL is set, also writes receipt.ses.json, a ready
// `aws sesv2 send-email --cli-input-json file://…` payload for a live test.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  renderOrderReceiptEmail,
  renderNewOrderAdminEmail,
  type OrderEmailData,
} from '@/lib/emails';

const sample: OrderEmailData = {
  id: 'clpreview0order01',
  name: 'Maija Meikäläinen',
  email: 'maija@example.com',
  totalCents: 4100,
  lines: [
    {
      name: 'PitVa-huivi',
      quantity: 2,
      priceCents: 1600,
      answers: [{ prompt: 'Koko', answer: 'M' }],
    },
    { name: 'Hihamerkki', quantity: 1, priceCents: 900, answers: [] },
  ],
};

const outDir = resolve(process.argv[2] ?? 'email-previews');
mkdirSync(outDir, { recursive: true });

const receipt = renderOrderReceiptEmail(sample);
const admin = renderNewOrderAdminEmail(sample);

writeFileSync(join(outDir, 'receipt.html'), receipt.html);
writeFileSync(join(outDir, 'new-order.html'), admin.html);
console.log('Wrote previews to', outDir);
console.log(' -', receipt.subject);
console.log(' -', admin.subject);

const testEmail = process.env.TEST_EMAIL;
if (testEmail) {
  const from = process.env.KAUPPA_SES_FROM_EMAIL ?? 'kontti-noreply@pitkajarvenvaeltajat.fi';
  const payload = {
    FromEmailAddress: from,
    Destination: { ToAddresses: [testEmail] },
    Content: {
      Simple: {
        Subject: { Data: receipt.subject, Charset: 'UTF-8' },
        Body: { Html: { Data: receipt.html, Charset: 'UTF-8' } },
      },
    },
  };
  writeFileSync(join(outDir, 'receipt.ses.json'), JSON.stringify(payload, null, 2));
  console.log(`Wrote SES send payload for ${testEmail} -> ${join(outDir, 'receipt.ses.json')}`);
}
