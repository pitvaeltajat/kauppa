import type { Metadata } from 'next';
import Link from 'next/link';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Maksu peruuntui' };

export default function CancelPage() {
  return (
    <div className="container flex justify-center py-12">
      <Card className="w-full max-w-xl">
        <CardHeader className="items-center text-center">
          <XCircle className="size-12 text-destructive" />
          <CardTitle>Maksu peruuntui</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <p className="text-sm text-muted-foreground">
            Maksua ei suoritettu, eikä mitään veloitettu. Ostoskorisi on tallessa — voit
            palata kauppaan harkitsemaan.
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/cart">
              <Button variant="outline">Takaisin ostoskoriin</Button>
            </Link>
            <Link href="/">
              <Button variant="cta">Jatka ostoksia</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
