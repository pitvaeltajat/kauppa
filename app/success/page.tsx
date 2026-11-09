import type { Metadata } from 'next';
import { CheckCircle2 } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/money';
import { ButtonLink } from '@/components/ui/button-link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Kiitos tilauksesta' };

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const order = session_id
    ? await prisma.order.findUnique({
        where: { stripeSessionId: session_id },
        include: { lines: { include: { item: true } } },
      })
    : null;

  return (
    <div className="container flex justify-center py-12">
      <Card className="w-full max-w-xl">
        <CardHeader className="items-center text-center">
          <CheckCircle2 className="size-12 text-success" />
          <CardTitle>Kiitos tilauksesta!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {order ? (
            <>
              <p className="text-sm text-muted-foreground">
                Tilaus{' '}
                <span className="font-medium text-foreground">#{order.id.slice(-8).toUpperCase()}</span>{' '}
                on vahvistettu ja maksu on vastaanotettu. Kuitti on lähetetty sähköpostiisi.
              </p>
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
                              {Array.isArray(answer.answer) ? answer.answer.join(', ') : answer.answer}
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
              Maksu on vastaanotettu. Jos kuitti ei tullut perille, ota yhteyttä:
              info@pitkajarvenvaeltajat.fi.
            </p>
          )}

          <div className="rounded-md bg-accent/60 px-4 py-3 text-xs text-muted-foreground">
            Tuotteet noudetaan kokouksessa ryhmänjohtajalta tai erikseen sovittuna aikana kololta.
            Emme postita tuotteita. Tapahtumatuotteen ostaminen vahvistaa ilmoittautumisen.
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <ButtonLink href="/" variant="cta">
              Takaisin tuotteisiin
            </ButtonLink>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
