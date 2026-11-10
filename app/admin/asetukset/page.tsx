import type { Metadata } from 'next';
import { requireSuperAdmin } from '@/lib/admin-guard';
import { getSiteSettings } from '@/lib/siteSettings';
import { BannerSettingsForm } from '@/components/admin/banner-settings-form';

export const metadata: Metadata = { title: 'Asetukset' };

export default async function AdminSettingsPage() {
  await requireSuperAdmin();
  const settings = await getSiteSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Etusivun banneri</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Valitse etusivun bannerin taustakuva. Yhteystiedot ja esittelyteksti ovat kiinteät.
        </p>
      </div>
      <BannerSettingsForm
        bannerImageUrl={settings?.bannerImageUrl ?? null}
        bannerPosition={settings?.bannerPosition ?? '50% 50%'}
      />
    </div>
  );
}
