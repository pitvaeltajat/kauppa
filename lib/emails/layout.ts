// HTML email shell, adapted from klapi's utils/emailHelpers.ts so kontti's mail
// reads as the same product. Inline styles alongside the <style> block because
// Gmail/Outlook drop <head> styles. Brand colours match styles/globals.css.

export interface EmailContent {
  subject: string;
  html: string;
}

function styles(): string {
  return `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #33314D; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ECF2FE; }
      .email-container { background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
      h1 { color: #221E5D; font-size: 22px; margin-top: 0; margin-bottom: 16px; }
      h2 { color: #221E5D; font-size: 16px; margin-top: 24px; margin-bottom: 12px; }
      p { margin: 12px 0; }
      .info-box { background-color: #F1F5FE; border-left: 4px solid #221E5D; padding: 12px 15px; margin: 16px 0; border-radius: 4px; }
      table.lines { width: 100%; border-collapse: collapse; margin: 12px 0; }
      table.lines th { text-align: left; font-size: 12px; text-transform: uppercase; color: #5A5874; border-bottom: 1px solid #DDD9D7; padding: 6px 0; }
      table.lines td { padding: 8px 0; border-bottom: 1px solid #EAE7E6; vertical-align: top; color: #221E5D; }
      table.lines td.num, table.lines th.num { text-align: right; white-space: nowrap; }
      .answers { font-size: 12px; color: #5A5874; margin-top: 2px; }
      .total-row td { border-bottom: none; padding-top: 12px; font-weight: 700; font-size: 16px; }
      .button { display: inline-block; padding: 12px 22px; background-color: #221E5D; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 16px 0; font-weight: 600; }
      .footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #DDD9D7; font-size: 12px; color: #5A5874; text-align: center; }
      .footer p { margin: 4px 0; }
      @media only screen and (max-width: 600px) { body { padding: 8px !important; } .email-container { padding: 20px !important; } }
    </style>`;
}

export function renderButton(href: string, label: string): string {
  const style =
    'display: inline-block; padding: 12px 22px; background-color: #221E5D; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 16px 0; font-weight: 600;';
  return `<a href="${href}" class="button" style="${style}">${escapeHtml(label)}</a>`;
}

export function renderEmail(innerHtml: string): string {
  return `<!DOCTYPE html>
<html lang="fi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  ${styles()}
</head>
<body>
  <div class="email-container">
    ${innerHtml}
    <div class="footer">
      <p><i>Tämä on automaattinen viesti. Älä vastaa tähän sähköpostiin.</i></p>
      <p>Pitkäjärven Vaeltajat · Kontti</p>
    </div>
  </div>
</body>
</html>`;
}

/** Escape user-supplied text before interpolating it into email HTML. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** The public base URL of the shop, for links in emails. */
export function publicUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}
