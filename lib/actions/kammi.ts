'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getUserRole, isSuperAdmin } from '@/lib/admin';
import { parseEurosInput } from '@/lib/money';
import { cancelKammiBooking } from '@/lib/kammiBookings';
import type { ActionResult } from '@/lib/actions/admin';

async function requireSuper(): Promise<boolean> {
  const session = await auth();
  return isSuperAdmin(await getUserRole(session?.user?.email ?? null));
}

export async function saveKammiSettings(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await requireSuper())) return { error: 'Sinulla ei ole tähän käyttöoikeutta.' };

  const euros = (name: string) => parseEurosInput((formData.get(name) as string) ?? '');
  const weekendScoutCents = euros('weekendScout');
  const weekendOtherCents = euros('weekendOther');
  const weekdayScoutCents = euros('weekdayScout');
  const weekdayOtherCents = euros('weekdayOther');
  if (
    weekendScoutCents === null ||
    weekendOtherCents === null ||
    weekdayScoutCents === null ||
    weekdayOtherCents === null
  ) {
    return { error: 'Tarkista hinnat. Käytä esimerkiksi muotoa 200 tai 200,00.' };
  }

  const minNights = Math.max(1, Number((formData.get('minNights') as string) ?? '1') || 1);
  const maxNights = Math.max(minNights, Number((formData.get('maxNights') as string) ?? '14') || 14);
  const keycode = ((formData.get('keycode') as string) ?? '').trim();
  const instructions = ((formData.get('instructions') as string) ?? '').trim();
  const active = formData.get('active') === 'on';

  await prisma.kammiSettings.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      active,
      weekendScoutCents,
      weekendOtherCents,
      weekdayScoutCents,
      weekdayOtherCents,
      minNights,
      maxNights,
      keycode,
      instructions,
    },
    update: {
      active,
      weekendScoutCents,
      weekendOtherCents,
      weekdayScoutCents,
      weekdayOtherCents,
      minNights,
      maxNights,
      keycode,
      instructions,
    },
  });

  revalidatePath('/admin/kammi');
  revalidatePath('/kammi');
  return {};
}

/** Admin cancels a booking, freeing the dates and removing its calendar event. */
export async function cancelKammiBookingAction(formData: FormData): Promise<void> {
  if (!(await requireSuper())) return;
  const id = ((formData.get('id') as string) ?? '').trim();
  if (!id) return;
  await cancelKammiBooking(id);
  revalidatePath('/admin/kammi');
  revalidatePath('/kammi');
}
