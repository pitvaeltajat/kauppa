import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { auth } from '@/lib/auth';
import { isAdminUser, isDevLoginEnabled } from '@/lib/admin';
import { LoginForm } from '@/components/login-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Kirjaudu sisään' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const safeCallback =
    typeof callbackUrl === 'string' && callbackUrl.startsWith('/') ? callbackUrl : '/admin';

  const session = await auth();
  const email = session?.user?.email ?? null;
  if (email && (await isAdminUser(email))) {
    redirect(safeCallback);
  }

  // Signed in, but not an admin — roles live in the database, so no env-based
  // allowlist can help. An existing admin must promote the User row.
  if (email) {
    return (
      <div className="container flex justify-center py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            <ShieldAlert className="size-10 text-warning" />
            <CardTitle>Ei pääsyoikeutta hallintaan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center text-sm text-muted-foreground">
            <p>
              Tilis {email} ei ole vielä ylläpitäjä. Ylläpitäjät määritetään tietokannassa —
              pyydä lippukunnan ATK-vastaavaa lisäämään sinut (Hallinta → Käyttäjät).
            </p>
            <Link href="/">
              <Button variant="outline">Takaisin kauppaan</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container flex justify-center py-12">
      <LoginForm devEnabled={isDevLoginEnabled()} callbackUrl={safeCallback} />
    </div>
  );
}

