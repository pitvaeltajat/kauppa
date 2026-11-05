'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { slugify } from '@/lib/slug';
import { parseEurosInput } from '@/lib/money';

export type ActionResult = { error?: string };

async function requireAdmin(): Promise<boolean> {
  const session = await auth();
  return Boolean(session?.user?.email && isAdminEmail(session.user.email));
}

// --- Items ----------------------------------------------------------------

export async function saveItem(
  prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { error: 'Ei käyttöoikeutta. Kirjaudu sisään.' };

  const id = ((formData.get('id') as string) ?? '').trim() || undefined;
  const name = ((formData.get('name') as string) ?? '').trim();
  if (!name) return { error: 'Nimi puuttuu.' };

  const categoryId = ((formData.get('categoryId') as string) ?? '').trim();
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
  };

  if (id) {
    await prisma.item.update({ where: { id }, data });
  } else {
    await prisma.item.create({ data });
  }

  revalidatePath('/', 'layout');
  redirect('/admin/items');
}

export async function hideItem(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const id = ((formData.get('id') as string) ?? '').trim();
  if (!id) return;
  await prisma.item.update({ where: { id }, data: { active: false } });
  revalidatePath('/', 'layout');
}

// --- Categories -----------------------------------------------------------

export async function saveCategory(
  prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { error: 'Ei käyttöoikeutta. Kirjaudu sisään.' };

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
  if (!(await requireAdmin())) return;

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
  if (!(await requireAdmin())) return;
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
