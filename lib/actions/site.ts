'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getUserRole, isSuperAdmin } from '@/lib/admin';
import type { ActionResult } from '@/lib/actions/admin';

async function requireSuper(): Promise<boolean> {
  const session = await auth();
  return isSuperAdmin(await getUserRole(session?.user?.email ?? null));
}

export async function saveSiteSettings(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await requireSuper())) return { error: 'Ei käyttöoikeutta.' };

  const bannerImageUrl = ((formData.get('bannerImageUrl') as string) ?? '').trim() || null;
  const bannerPosition = normalizeBannerPosition(formData.get('bannerPosition') as string);

  await prisma.siteSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', bannerImageUrl, bannerPosition },
    update: { bannerImageUrl, bannerPosition },
  });

  revalidatePath('/', 'layout');
  return {};
}

function normalizeBannerPosition(raw: string): string {
  const [x, y] = raw.split(/\s+/).map(Number);
  const clamp = (value: number) => Math.min(100, Math.max(0, Number.isFinite(value) ? value : 50));
  return `${clamp(x)}% ${clamp(y)}%`;
}
