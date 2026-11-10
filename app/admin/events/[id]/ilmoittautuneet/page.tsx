import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Ilmoittautuneet' };

/** Keep old Finnish links working while all canonical URLs stay English. */
export default async function LegacyRegistrantsRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/events/${id}/registrants`);
}
