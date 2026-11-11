import type { Metadata } from 'next';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';
import { formatCents } from '@/lib/money';
import { ButtonLink } from '@/components/ui/button-link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReceiptEmailForm } from '@/components/receipt-email-form';

export const metadata: Metadata = { title: 'Kiitos tilauksesta' };

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    session_id?: string | string[];
    redirect_status?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const sessionId = Array.isArray(params.session_id) ? params.session_id[0] : params.session_id;
  const redirectStatus = Array.isArray(params.redirect_status)
    ? params.redirect_status[0]
    : params.redirect_status;
  const order = sessionId
    ? await prisma.order.findFirst({
        where: { stripeSessionId: sessionId },
        include: { lines: { include: { item: true } } },
      })
    : null;
  const stripeSession = sessionId?.startsWith('cs_')
    ? await getStripe()
        .checkout.sessions.retrieve(sessionId)
        .catch(() => null)
    : null;
  const paymentFailed =
    redirectStatus === 'failed' ||
    redirectStatus === 'canceled' ||
    stripeSession?.payment_status === 'unpaid' ||
    stripeSession?.status === 'expired';
  const isEventOrder = order?.lines.some((line) => line.item.isEvent) ?? false;

  return (
    <div className="container flex justify-center py-12">
      <Card className="w-full max-w-xl">
        <CardHeader className="items-center text-center">
          {paymentFailed ? (
            <>
              <AlertCircle className="size-12 text-destructive" />
              <CardTitle>Maksu ei onnistunut</CardTitle>
            </>
          ) : (
            <>
              <CheckCircle2 className="size-12 text-success" />
              <CardTitle>Kiitos tilauksesta!</CardTitle>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {paymentFailed ? (
            <>
              <p className="text-sm text-muted-foreground">
                Maksua ei veloitettu. Voit palata ostoskoriin ja yrittää uudelleen toisella
                maksutavalla.
              </p>
              <div className="flex justify-center pt-2">
                <ButtonLink href="/cart" variant="cta">
                  Palaa ostoskoriin
                </ButtonLink>
              </div>
            </>
          ) : order ? (
            <>
              <p className="text-sm text-muted-foreground">
                Tilaus{' '}
                <span className="font-medium text-foreground">
                  #{order.id.slice(-8).toUpperCase()}
                </span>{' '}
                on vastaanotettu. Maksu vahvistetaan hetken kuluttua ja kuitti lähetetään
                sähköpostiisi.
              </p>
              {!order.email && order.status === 'PAID' && sessionId && (
                <ReceiptEmailForm sessionId={sessionId} />
              )}
              <div className="divide-y rounded-md border">
                {order.lines.map((line) => {
                  const answers = Array.isArray(line.answers)
                    ? (line.answers as {
                        questionId: string;
                        prompt?: string;
                        answer?: string | string[];
                      }[])
                    : [];
                  return (
                    <div key={line.id} className="px-4 py-2 text-sm">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0">
                          {line.name}{' '}
                          <span className="text-muted-foreground">× {line.quantity}</span>
                        </span>
                        <span className="shrink-0 font-medium">
                          {formatCents(line.priceCents * line.quantity)}
                        </span>
                      </div>
                      {answers.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                          {answers.map((answer) => (
                            <li key={answer.questionId}>
                              {answer.prompt}:{' '}
                              {Array.isArray(answer.answer)
                                ? answer.answer.join(', ')
                                : answer.answer}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
                <div className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm font-bold">
                  <span>Yhteensä</span>
                  <span>{formatCents(order.totalCents)}</span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Maksun tilaa ei voitu varmistaa. Jos rahaa veloitettiin, ota yhteyttä:
              info@pitkajarvenvaeltajat.fi.
            </p>
          )}

          {!paymentFailed && order && (
            <div className="rounded-md bg-accent/60 px-4 py-3 text-xs text-muted-foreground">
              {isEventOrder
                ? 'Tapahtumatuotteen ostaminen vahvisti ilmoittautumisen. Saat tapahtuman tarkemmat ohjeet erikseen.'
                : 'Tuotteet noudetaan kokouksessa ryhmänjohtajalta tai erikseen sovittuna aikana kololta. Emme postita tuotteita.'}
            </div>
          )}

          {!paymentFailed && (
            <div className="flex justify-center gap-3 pt-2">
              <ButtonLink href="/" variant="cta">
                Takaisin tuotteisiin
              </ButtonLink>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
