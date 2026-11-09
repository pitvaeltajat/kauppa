import type { Metadata } from 'next';
import { CheckCircle2 } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button-link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Kiitos varauksesta' };

export default function KammiThanksPage() {
  return (
    <div className="container flex justify-center py-12">
      <Card className="w-full max-w-xl">
        <CardHeader className="items-center text-center">
          <CheckCircle2 className="size-12 text-success" />
          <CardTitle>Kiitos. Kammi on varattu.</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-muted-foreground">
            Maksu onnistui ja varaus on vahvistettu. Ovikoodi ja ohjeet on lähetetty
            sähköpostiisi. Tarkista roskapostikansio, jos viestiä ei näy hetken kuluttua.
          </p>
          <ButtonLink href="/kammi" variant="cta">
            Takaisin varauskalenteriin
          </ButtonLink>
        </CardContent>
      </Card>
    </div>
  );
}
