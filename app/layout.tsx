import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getUserRole, isSuperAdmin } from '@/lib/admin';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import '@/styles/globals.css';

// The catalog is read from Postgres on every request, so nothing here is
// prerendered at build time (the build server has no database).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    default: 'Kontti · Pitkäjärven Vaeltajat',
    template: '%s · Kontti',
  },
  description:
    'Pitkäjärven Vaeltajien tuotteet ja tapahtumailmoittautumiset samassa paikassa. Tilaa huiveja, merkkejä ja muita PitVa-tuotteita tai ilmoittaudu tapahtumiin.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const email = session?.user?.email ?? null;
  // Read the role from kontti's own database, not the session token. A shared
  // .pitva.fi cookie from another pitva app carries that app's role claim.
  const role = email ? await getUserRole(email) : null;
  const superAdmin = isSuperAdmin(role);

  const pathname = (await headers()).get('x-pathname') ?? '';

  // "Kesken": only superadmins reach the app. Everyone else goes to /login,
  // which renders bare: nothing but the Google button, no shop chrome.
  if (!superAdmin && pathname !== '/login') {
    redirect('/login');
  }

  if (!superAdmin) {
    return (
      <html lang="fi">
        <body>
          <main className="flex min-h-screen flex-col justify-center">{children}</main>
        </body>
      </html>
    );
  }

  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  return (
    <html lang="fi">
      <body>
        <div className="flex min-h-screen flex-col">
          <SiteHeader categories={categories} role={role ?? undefined} />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
