import type { Metadata } from 'next';
import { requireSuperAdmin } from '@/lib/admin-guard';
import { getKammiSettings } from '@/lib/kammiBookings';
import { prisma } from '@/lib/prisma';
import { KammiSettingsForm } from '@/components/admin/kammi-settings-form';

export const metadata: Metadata = { title: 'Kammin asetukset' };

export default async function AdminKammiSettingsPage() {
  await requireSuperAdmin();
  const [settings, accountingClasses] = await Promise.all([
    getKammiSettings(),
    prisma.accountingClass.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Kammin asetukset</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hallitse Kammin varausta, hintoja, ohjeita ja julkisen sivun sisältöä.
        </p>
      </div>
      <KammiSettingsForm settings={settings} accountingClasses={accountingClasses} />
    </div>
  );
}
