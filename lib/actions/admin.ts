'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getUserRole, isEventAdmin, isSuperAdmin, type Role } from '@/lib/admin';
import { slugify } from '@/lib/slug';
import { parseEurosInput } from '@/lib/money';
import { parseQuestionDrafts } from '@/lib/questions';
import { LEADER_DISCOUNT_CODE, normalizeCode } from '@/lib/discount';
import { isSystemCategorySlug } from '@/lib/categories';

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

  // Never demote yourself. There would be no one left to promote you back.
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
  if (!isEventAdmin(role))
    return { error: 'Sinulla ei ole tähän käyttöoikeutta. Kirjaudu sisään.' };

  const id = ((formData.get('id') as string) ?? '').trim() || undefined;
  const name = ((formData.get('name') as string) ?? '').trim();
  if (!name) return { error: 'Anna tuotteelle nimi.' };

  // Events and products use separate admin flows. Event admins can only use
  // the event flow; superadmins create products unless the event flow marks
  // the submission explicitly.
  const isEvent = !isSuperAdmin(role) || formData.get('eventMode') === 'on';

  let oldSlug: string | null = null;
  if (id) {
    const current = await prisma.item.findUnique({
      where: { id },
      select: { slug: true, isEvent: true },
    });
    if (!current) return { error: 'Tuotetta ei löytynyt.' };
    if (current.isEvent !== isEvent) {
      return { error: 'Tapahtumia ja tuotteita hallitaan erillisissä näkymissä.' };
    }
    if (!isSuperAdmin(role) && !current.isEvent) {
      return { error: 'Sinulla ei ole oikeutta muokata tätä tuotetta.' };
    }
    oldSlug = current.slug;
  }

  let startsAt: Date | null = null;
  let endsAt: Date | null = null;
  if (isEvent) {
    startsAt = parseDate((formData.get('startsAt') as string) ?? '');
    endsAt = parseDate((formData.get('endsAt') as string) ?? '');
    if (!startsAt || !endsAt) return { error: 'Anna tapahtumalle alku- ja päättymispäivä.' };
    if (endsAt < startsAt) return { error: 'Päättymispäivä ei voi olla ennen alkamispäivää.' };
  }
  const hidden = formData.get('hidden') === 'on';
  // Leaders' discount is an event-only opt-in (a leaderOnly code discounts it).
  const leaderDiscount = isEvent && formData.get('leaderDiscount') === 'on';

  // Events live in Tapahtumat; a non-event takes the category the form chose.
  const categoryId = isEvent
    ? await eventCategoryId()
    : ((formData.get('categoryId') as string) ?? '').trim();
  if (!categoryId) return { error: 'Valitse kategoria.' };
  if (!isEvent) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { slug: true },
    });
    if (!category || isSystemCategorySlug(category.slug)) {
      return { error: 'Valitse tavalliselle tuotteelle tavallinen kategoria.' };
    }
  }

  const accountingClassId = ((formData.get('accountingClassId') as string) ?? '').trim() || null;
  if (accountingClassId) {
    const accountingClass = await prisma.accountingClass.findUnique({
      where: { id: accountingClassId },
      select: { id: true },
    });
    if (!accountingClass) return { error: 'Valittu kirjanpitoluokka ei ole käytettävissä.' };
  }

  const priceCents = parseEurosInput((formData.get('price') as string) ?? '');
  if (priceCents === null) return { error: 'Anna hinta, esimerkiksi 16,00.' };

  const slug = slugify(((formData.get('slug') as string) ?? '').trim() || name);
  const existing = await prisma.item.findUnique({ where: { slug } });
  if (existing && existing.id !== id) {
    return { error: `Slug "${slug}" on jo toisen tuotteen käytössä.` };
  }
  // The new slug must not be another item's old URL either (that redirect would
  // then clash). A past slug of this same item is fine. It becomes live again.
  const aliasOwner = await prisma.itemSlug.findUnique({ where: { slug } });
  if (aliasOwner && aliasOwner.itemId !== id) {
    return { error: `Slug "${slug}" on toisen tuotteen vanha osoite.` };
  }

  const stockRaw = ((formData.get('stock') as string) ?? '').trim();
  const stock = stockRaw === '' ? null : Number(stockRaw);
  if (stock !== null && (!Number.isInteger(stock) || stock < 0)) {
    return {
      error: 'Anna varastomäärä kokonaislukuna tai jätä kenttä tyhjäksi, jos määrää ei rajoiteta.',
    };
  }

  const imageUrl = ((formData.get('imageUrl') as string) ?? '').trim() || null;
  const sortOrder = Number((formData.get('sortOrder') as string) ?? '0') || 0;
  const active = formData.get('active') === 'on';
  const featured = formData.get('featured') === 'on';
  const description = ((formData.get('description') as string) ?? '').trim();

  // Checkout questions come as a JSON string; an empty array clears them.
  let questionRows: { prompt: string; type: string; required: boolean; options: string[] }[] = [];
  const questionsRaw = ((formData.get('questions') as string) ?? '').trim();
  if (questionsRaw) {
    const parsed = parseQuestionDrafts(questionsRaw);
    if (!parsed.ok) return { error: parsed.error };
    questionRows = parsed.questions;
  }

  const data = {
    name,
    slug,
    categoryId,
    accountingClassId,
    priceCents,
    stock,
    imageUrl,
    sortOrder,
    active,
    featured,
    description,
    isEvent,
    startsAt,
    endsAt,
    hidden,
    leaderDiscount,
  };

  if (id) {
    // Keep the old slug alive as a redirect; drop any stale alias that equals
    // the new live slug (e.g. this item reclaiming one of its own past slugs).
    const aliasOps: Prisma.PrismaPromise<unknown>[] = [
      prisma.itemSlug.deleteMany({ where: { slug } }),
    ];
    if (oldSlug && oldSlug !== slug) {
      aliasOps.push(
        prisma.itemSlug.upsert({
          where: { slug: oldSlug },
          create: { slug: oldSlug, itemId: id },
          update: { itemId: id },
        }),
      );
    }
    await prisma.$transaction([
      prisma.item.update({ where: { id }, data }),
      ...aliasOps,
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
  if (!isSuperAdmin(await currentRole()))
    return { error: 'Sinulla ei ole tähän käyttöoikeutta. Kirjaudu sisään.' };

  const id = ((formData.get('id') as string) ?? '').trim() || undefined;
  const name = ((formData.get('name') as string) ?? '').trim();
  if (!name) return { error: 'Anna kategorialle nimi.' };

  const slug = slugify(((formData.get('slug') as string) ?? '').trim() || name);
  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing && existing.id !== id) {
    return { error: `Slug "${slug}" on jo toisen kategorian käytössä.` };
  }

  const description = ((formData.get('description') as string) ?? '').trim() || null;
  const sortOrder = Number((formData.get('sortOrder') as string) ?? '0') || 0;

  if (id) {
    const current = await prisma.category.findUnique({ where: { id }, select: { slug: true } });
    if (!current) return { error: 'Kategoriaa ei löytynyt.' };
    if (isSystemCategorySlug(current.slug)) {
      return { error: 'Tapahtumat on järjestelmäkategoria, eikä sitä voi muuttaa.' };
    }
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

  const category = await prisma.category.findUnique({ where: { id }, select: { slug: true } });
  if (!category || isSystemCategorySlug(category.slug)) return;

  const itemCount = await prisma.item.count({ where: { categoryId: id } });
  if (itemCount > 0) return; // guarded in the UI by disabling the button

  await prisma.category.delete({ where: { id } });
  revalidatePath('/', 'layout');
  // Re-render the categories page to reflect the change.
  redirect('/admin/categories');
}

// --- Accounting classes --------------------------------------------------

export async function saveAccountingClass(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  if (!isSuperAdmin(await currentRole())) return { error: 'Ei käyttöoikeutta.' };

  const name = ((formData.get('name') as string) ?? '').trim().slice(0, 120);
  if (!name) return { error: 'Anna kirjanpitoluokalle nimi.' };
  const sortOrder = Number((formData.get('sortOrder') as string) ?? '0') || 0;
  const existing = await prisma.accountingClass.findUnique({ where: { name } });
  if (existing) return { error: 'Tämän niminen kirjanpitoluokka on jo olemassa.' };

  await prisma.accountingClass.create({ data: { name, sortOrder } });
  revalidatePath('/admin/accounting-classes');
  return {};
}

export async function deleteAccountingClass(formData: FormData): Promise<void> {
  if (!isSuperAdmin(await currentRole())) return;
  const id = ((formData.get('id') as string) ?? '').trim();
  if (!id) return;
  const itemCount = await prisma.item.count({ where: { accountingClassId: id } });
  const bookingCount = await prisma.kammiBooking.count({ where: { accountingClassId: id } });
  if (itemCount > 0 || bookingCount > 0) return;
  await prisma.accountingClass.delete({ where: { id } });
  revalidatePath('/admin/accounting-classes');
  redirect('/admin/accounting-classes');
}

// --- Discount codes -------------------------------------------------------

export async function saveDiscount(
  prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  if (!isSuperAdmin(await currentRole())) return { error: 'Ei käyttöoikeutta. Kirjaudu sisään.' };

  const id = ((formData.get('id') as string) ?? '').trim() || undefined;
  const code = normalizeCode(((formData.get('code') as string) ?? '').trim());
  if (!/^[A-ZÅÄÖ0-9]{2,32}$/.test(code)) {
    return { error: 'Koodi: 2–32 kirjainta tai numeroa (ei välilyöntejä).' };
  }

  const percentOff = Number(((formData.get('percentOff') as string) ?? '').trim());
  if (!Number.isInteger(percentOff) || percentOff < 1 || percentOff > 100) {
    return { error: 'Alennusprosentti on 1–100.' };
  }

  const validUntilRaw = ((formData.get('validUntil') as string) ?? '').trim();
  const validUntil = validUntilRaw ? parseDate(validUntilRaw) : null;
  if (validUntilRaw && !validUntil) return { error: 'Virheellinen päättymispäivä.' };

  const existing = await prisma.discountCode.findUnique({ where: { code } });
  if (existing && existing.id !== id) {
    return { error: `Koodi "${code}" on jo käytössä.` };
  }
  if (id) {
    const current = await prisma.discountCode.findUnique({ where: { id }, select: { code: true } });
    if (current?.code === 'JOHTAJA') {
      return { error: 'JOHTAJA-koodi on järjestelmäkoodi eikä sitä voi muuttaa.' };
    }
  }

  const data = {
    code,
    description: ((formData.get('description') as string) ?? '').trim(),
    percentOff,
    // JOHTAJA is the only code that is scoped to leader-discount events.
    leaderOnly: code === LEADER_DISCOUNT_CODE,
    active: formData.get('active') === 'on',
    validUntil,
  };

  if (id) {
    await prisma.discountCode.update({ where: { id }, data });
  } else {
    await prisma.discountCode.create({ data });
  }
  revalidatePath('/admin/discounts');
  redirect('/admin/discounts');
}

export async function deleteDiscount(formData: FormData): Promise<void> {
  if (!isSuperAdmin(await currentRole())) return;
  const id = ((formData.get('id') as string) ?? '').trim();
  if (!id) return;
  const discount = await prisma.discountCode.findUnique({ where: { id }, select: { code: true } });
  if (!discount || discount.code === 'JOHTAJA') return;
  await prisma.discountCode.delete({ where: { id } });
  redirect('/admin/discounts');
}

// --- Orders ---------------------------------------------------------------

export async function cancelOrder(formData: FormData): Promise<void> {
  if (!isSuperAdmin(await currentRole())) return;
  const id = ((formData.get('id') as string) ?? '').trim();
  if (!id) return;

  await prisma.order.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });
  revalidatePath('/admin');
}
