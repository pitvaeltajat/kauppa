import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { auth } from '@/lib/auth';
import { getUserRole, isSuperAdmin, isDevLoginEnabled } from '@/lib/admin';
import { LoginForm } from '@/components/login-form';
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
  // Only superadmins reach the app while the shop is "kesken".
  if (email && isSuperAdmin(await getUserRole(email))) {
    redirect(safeCallback);
  }

  // Signed in but not a superadmin — including a shared .pitva.fi cookie from
  // another pitva app. The shop isn't open to them yet.
  if (email) {
    return (
      <div className="container flex justify-center py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            <ShieldAlert className="size-10 text-warning" />
            <CardTitle>Kauppa on vielä kesken</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center text-sm text-muted-foreground">
            <p>
              Tilillä {email} ei ole vielä pääsyä kauppaan. Kauppa on toistaiseksi vain
              pääylläpitäjien käytössä — pyydä lippukunnan ATK-vastaavaa lisäämään sinut.
            </p>
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

