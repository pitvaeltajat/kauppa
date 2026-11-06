'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getUserRole, isEventAdmin, isSuperAdmin, type Role } from '@/lib/admin';
import { slugify } from '@/lib/slug';
import { parseEurosInput } from '@/lib/money';
import { parseQuestionDrafts } from '@/lib/questions';

export type ActionResult = { error?: string };

/** Role of the signed-in person, or null when not signed in. */
async function currentRole(): Promise<Role | null> {
  const session = await auth();
  return getUserRole(session?.user?.email ?? null);
}

/** Events live in the "Tapahtumat" category so event admins need no category
 * access; find-or-create it. */
async function eventCategoryId(): Promise<string> {
  const category = await prisma.category.upsert({
    where: { slug: 'tapahtumat' },
    update: {},
    create: { name: 'Tapahtumat', slug: 'tapahtumat', sortOrder: 2 },
  });
  return category.id;
}

/** Date-only input ("YYYY-MM-DD") to a Date at midnight, or null. */
function parseDate(raw: string): Date | null {
  const value = raw.trim();
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// --- Users ----------------------------------------------------------------

export async function setUserRole(formData: FormData): Promise<void> {
  // Only superadmins change roles, and the only grant worth toggling is
  // SUPERADMIN (EVENT_ADMIN is derived from the email domain on sign-in).
  const session = await auth();
  const adminEmail = session?.user?.email?.trim().toLowerCase() ?? null;
  if (!isSuperAdmin(await getUserRole(adminEmail))) return;

  const id = ((formData.get('id') as string) ?? '').trim();
  const role = (formData.get('role') as string) ?? '';
  if (!id || (role !== 'SUPERADMIN' && role !== 'EVENT_ADMIN' && role !== 'USER')) return;

  // Never demote yourself — there would be no one left to promote you back.
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.email === adminEmail) return;

  await prisma.user.update({ where: { id }, data: { role } });
  revalidatePath('/admin/users');
}

// --- Items ----------------------------------------------------------------

export async function saveItem(
  prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const role = await currentRole();
  if (!isEventAdmin(role)) return { error: 'Ei käyttöoikeutta. Kirjaudu sisään.' };

  const id = ((formData.get('id') as string) ?? '').trim() || undefined;
  const name = ((formData.get('name') as string) ?? '').trim();
  if (!name) return { error: 'Nimi puuttuu.' };

  // Event admins may only touch events; superadmins may create either kind.
  const isEvent = !isSuperAdmin(role) || formData.get('isEvent') === 'on';

  let startsAt: Date | null = null;
  let endsAt: Date | null = null;
  if (isEvent) {
    startsAt = parseDate((formData.get('startsAt') as string) ?? '');
    endsAt = parseDate((formData.get('endsAt') as string) ?? '');
    if (!startsAt || !endsAt) return { error: 'Tapahtumalle on annettava alkamis- ja päättymispäivä.' };
    if (endsAt < startsAt) return { error: 'Päättymispäivä ei voi olla ennen alkamispäivää.' };
  }
  const hidden = formData.get('hidden') === 'on';

  // Events live in Tapahtumat; a non-event takes the category the form chose.
  const categoryId = isEvent
    ? await eventCategoryId()
    : ((formData.get('categoryId') as string) ?? '').trim();
  if (!categoryId) return { error: 'Valitse kategoria.' };

  const priceCents = parseEurosInput((formData.get('price') as string) ?? '');
  if (priceCents === null) return { error: 'Anna kelvollinen hinta (esim. 16,00).' };

  const slug = slugify(((formData.get('slug') as string) ?? '').trim() || name);
  const existing = await prisma.item.findUnique({ where: { slug } });
  if (existing && existing.id !== id) {
    return { error: `Slug "${slug}" on jo toisen tuotteen käytössä.` };
  }

  const stockRaw = ((formData.get('stock') as string) ?? '').trim();
  const stock = stockRaw === '' ? null : Number(stockRaw);
  if (stock !== null && (!Number.isInteger(stock) || stock < 0)) {
    return { error: 'Varastomäärä on virheellinen (tyhjä = rajoittamaton).' };
  }

  const imageUrl = ((formData.get('imageUrl') as string) ?? '').trim() || null;
  const sortOrder = Number((formData.get('sortOrder') as string) ?? '0') || 0;
  const active = formData.get('active') === 'on';
  const description = ((formData.get('description') as string) ?? '').trim();

  // Checkout questions come as a JSON string; an empty array clears them.
  let questionRows: { prompt: string; type: string; required: boolean; options: string[] }[] = [];
  const questionsRaw = ((formData.get('questions') as string) ?? '').trim();
  if (questionsRaw) {
    const parsed = parseQuestionDrafts(questionsRaw);
    if (!parsed.ok) return { error: parsed.error };
    questionRows = parsed.questions;
  }

  // Event admins may edit events only, never a regular product.
  if (id && !isSuperAdmin(role)) {
    const target = await prisma.item.findUnique({ where: { id }, select: { isEvent: true } });
    if (!target?.isEvent) return { error: 'Ei käyttöoikeutta tähän tuotteeseen.' };
  }

  const data = {
    name,
    slug,
    categoryId,
    priceCents,
    stock,
    imageUrl,
    sortOrder,
    active,
    description,
    isEvent,
    startsAt,
    endsAt,
    hidden,
  };

  if (id) {
    await prisma.$transaction([
      prisma.item.update({ where: { id }, data }),
      prisma.itemQuestion.deleteMany({ where: { itemId: id } }),
      ...(questionRows.length === 0
        ? []
        : [
            prisma.itemQuestion.createMany({
              data: questionRows.map((q, index) => ({
                itemId: id,
                prompt: q.prompt,
                type: q.type as 'TEXT' | 'NUMBER' | 'RADIO' | 'CHECKBOX',
                required: q.required,
                options: q.options,
                sortOrder: index,
              })),
            }),
          ]),
    ]);
  } else {
    const item = await prisma.item.create({
      data: {
        ...data,
        questions: {
          create: questionRows.map((q, index) => ({
            prompt: q.prompt,
            type: q.type as 'TEXT' | 'NUMBER' | 'RADIO' | 'CHECKBOX',
            required: q.required,
            options: q.options,
            sortOrder: index,
          })),
        },
      },
    });
    void item;
  }

  revalidatePath('/', 'layout');
  redirect(isEvent ? '/admin/events' : '/admin/items');
}

export async function hideItem(formData: FormData): Promise<void> {
  if (!isSuperAdmin(await currentRole())) return;
  const id = ((formData.get('id') as string) ?? '').trim();
  if (!id) return;
  await prisma.item.update({ where: { id }, data: { active: false } });
  revalidatePath('/', 'layout');
}

/** Toggle an event's "unlisted" flag (off the front page, direct link still
 * works). Event admins and superadmins; events only. */
export async function setEventHidden(formData: FormData): Promise<void> {
  if (!isEventAdmin(await currentRole())) return;
  const id = ((formData.get('id') as string) ?? '').trim();
  const hidden = formData.get('hidden') === 'true';
  if (!id) return;
  const target = await prisma.item.findUnique({ where: { id }, select: { isEvent: true } });
  if (!target?.isEvent) return;
  await prisma.item.update({ where: { id }, data: { hidden } });
  revalidatePath('/', 'layout');
  revalidatePath('/admin/events');
}

// --- Categories -----------------------------------------------------------

export async function saveCategory(
  prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  if (!isSuperAdmin(await currentRole())) return { error: 'Ei käyttöoikeutta. Kirjaudu sisään.' };

  const id = ((formData.get('id') as string) ?? '').trim() || undefined;
  const name = ((formData.get('name') as string) ?? '').trim();
  if (!name) return { error: 'Nimi puuttuu.' };

  const slug = slugify(((formData.get('slug') as string) ?? '').trim() || name);
  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing && existing.id !== id) {
    return { error: `Slug "${slug}" on jo toisen kategorian käytössä.` };
  }

  const description = ((formData.get('description') as string) ?? '').trim() || null;
  const sortOrder = Number((formData.get('sortOrder') as string) ?? '0') || 0;

  if (id) {
    await prisma.category.update({ where: { id }, data: { name, slug, description, sortOrder } });
  } else {
    await prisma.category.create({ data: { name, slug, description, sortOrder } });
  }

  revalidatePath('/', 'layout');
  redirect('/admin/categories');
}

export async function deleteCategory(formData: FormData): Promise<void> {
  if (!isSuperAdmin(await currentRole())) return;

  const id = ((formData.get('id') as string) ?? '').trim();
  if (!id) return;

  const itemCount = await prisma.item.count({ where: { categoryId: id } });
  if (itemCount > 0) return; // guarded in the UI by disabling the button

  await prisma.category.delete({ where: { id } });
  revalidatePath('/', 'layout');
  // Re-render the categories page to reflect the change.
  redirect('/admin/categories');
}

// --- Orders ---------------------------------------------------------------

const ORDER_STATUSES = ['RECEIVED', 'PAID', 'COMPLETED', 'CANCELLED'] as const;

export async function setOrderStatus(formData: FormData): Promise<void> {
  if (!isSuperAdmin(await currentRole())) return;
  const id = ((formData.get('id') as string) ?? '').trim();
  const status = (formData.get('status') as string) ?? '';
  if (!id || !ORDER_STATUSES.includes(status as (typeof ORDER_STATUSES)[number])) return;

  await prisma.order.update({
    where: { id },
    data: {
      status: status as (typeof ORDER_STATUSES)[number],
      paidAt: status === 'PAID' ? new Date() : undefined,
    },
  });
  revalidatePath('/admin');
}
