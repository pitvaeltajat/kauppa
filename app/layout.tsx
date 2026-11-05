import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import '@/styles/globals.css';

// The catalog is read from Postgres on every request, so nothing here is
// prerendered at build time (the build server has no database).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    default: 'Pitkäjärven Vaeltajien verkkokauppa',
    template: '%s · PitVa-kauppa',
  },
  description:
    'Partiolippukunta Pitkäjärven Vaeltajien nettikauppa ja ilmoittautumisportaali. Täältä voit ostaa huiveja, merkkejä ja PitVa-tuotteita.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  return (
    <html lang="fi">
      <body>
        <div className="flex min-h-screen flex-col">
          <SiteHeader categories={categories} />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
