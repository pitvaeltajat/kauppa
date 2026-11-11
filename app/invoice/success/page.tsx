import type { Metadata } from 'next';
import { FileText, MailCheck } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/money';
import { ButtonLink } from '@/components/ui/button-link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Lasku lähetetty' };

export default async function InvoiceSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const order = token
    ? await prisma.order.findFirst({
        where: { invoiceAccessToken: token, status: 'RECEIVED' },
        select: {
          id: true,
          email: true,
          totalCents: true,
          invoiceUrl: true,
          invoicePdfUrl: true,
          lines: { select: { name: true, quantity: true, priceCents: true } },
        },
      })
    : null;

  return (
    <div className="container flex justify-center py-12">
      <Card className="w-full max-w-xl">
        <CardHeader className="items-center text-center">
          <MailCheck className="size-12 text-success" />
          <CardTitle>Lasku on lähetetty</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {order ? (
            <>
              <p className="text-sm text-muted-foreground">
                Ilmoittautuminen{' '}
                <span className="font-medium text-foreground">
                  #{order.id.slice(-8).toUpperCase()}
                </span>{' '}
                on vastaanotettu. Lasku lähetettiin osoitteeseen{' '}
                <span className="font-medium text-foreground">{order.email}</span>. Ilmoittautuminen
                vahvistuu, kun lasku on maksettu.
              </p>
              <div className="divide-y rounded-md border">
                {order.lines.map((line, index) => (
                  <div
                    key={`${line.name}-${index}`}
                    className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm"
                  >
                    <span>
                      {line.name} <span className="text-muted-foreground">× {line.quantity}</span>
                    </span>
                    <span className="shrink-0 font-medium">
                      {formatCents(line.priceCents * line.quantity)}
                    </span>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm font-bold">
                  <span>Yhteensä</span>
                  <span>{formatCents(order.totalCents)}</span>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                {order.invoiceUrl && (
                  <ButtonLink
                    href={order.invoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                    variant="cta"
                  >
                    Avaa lasku
                  </ButtonLink>
                )}
                {order.invoicePdfUrl && (
                  <ButtonLink
                    href={order.invoicePdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    variant="outline"
                  >
                    <FileText className="size-4" /> Lataa PDF
                  </ButtonLink>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Lasku on luotu. Tarkista vanhemman sähköposti.
            </p>
          )}
          <div className="rounded-md bg-accent/60 px-4 py-3 text-xs text-muted-foreground">
            Tarkistathan, että vanhempi maksaa laskun ennen tapahtumaa. Laskun eräpäivä on 14 päivän
            kuluttua.
          </div>
          <div className="flex justify-center pt-2">
            <ButtonLink href="/" variant="cta">
              Takaisin tuotteisiin
            </ButtonLink>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
