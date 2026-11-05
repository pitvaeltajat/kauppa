import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/money';
import { Button } from '@/components/ui/button';
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
                Tilauksesi{' '}
                <span className="font-medium text-foreground">#{order.id.slice(-8).toUpperCase()}</span>{' '}
                on vahvistettu ja maksu vastaanotettu. Kuitti on lähetetty sähköpostiisi.
              </p>
              <div className="divide-y rounded-md border">
                {order.lines.map((line) => (
                  <div key={line.id} className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm">
                    <span className="min-w-0">
                      {line.name} <span className="text-muted-foreground">× {line.quantity}</span>
                    </span>
                    <span className="shrink-0 font-medium">{formatCents(line.priceCents * line.quantity)}</span>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm font-bold">
                  <span>Yhteensä</span>
                  <span>{formatCents(order.totalCents)}</span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Maksu on vastaanotettu. Jos et saanut kuittia, ota yhteyttä tuote- ja
              tilausasioissa: info@pitkajarvenvaeltajat.fi.
            </p>
          )}

          <div className="rounded-md bg-accent/60 px-4 py-3 text-xs text-muted-foreground">
            Tuotteet luovutetaan kokouksessa ryhmänjohtajaltasi tai sovitusti kololta — tästä
            kaupasta ei lähetetä postituksia. Tapahtumatuote vahvistaa ilmoittautumisen.
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <Link href="/">
              <Button variant="cta">Takaisin kauppaan</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
