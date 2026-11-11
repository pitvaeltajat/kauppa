// Seeds the catalog with the current holvi.pitva.fi assortment (scraped
// 2026-11). Idempotent: upserts by category/item slug, so re-running is safe
// and items renamed or added in the admin UI are left alone.
//
// Run with: pnpm db:seed

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { LEADER_DISCOUNT_CODE, LEADER_DISCOUNT_PERCENT } from '../lib/discount';

const prisma = new PrismaClient();

const categories = [
  {
    name: 'PitVa-tuotteet',
    slug: 'pitva-tuotteet',
    description: 'PitVa-merkkituotteita: pipoja, lakkeja, kasseja, huppareita ja nimikylttejä.',
    sortOrder: 1,
  },
  {
    name: 'Tapahtumat',
    slug: 'tapahtumat',
    description:
      'Ilmoittautumiset ja osallistumismaksut. Tapahtuman ostaminen on ilmoittautuminen.',
    sortOrder: 2,
  },
  {
    name: 'Huivit ja merkit',
    slug: 'huivit-ja-merkit',
    description: 'Partiohuivit ja partiopaidan merkit.',
    sortOrder: 3,
  },
];

const items = [
  // --- PitVa-tuotteet ---
  {
    name: 'PitVa-pipo',
    category: 'pitva-tuotteet',
    priceCents: 1600,
    stock: 33,
    description:
      'Laivastonsininen pipo, päärmeessä 60 mm brodeerattu valkoinen PitVa-logo. ' +
      'Osta taatusti Espoon metsäuskottavin pipo! Saat pipon kokouksessa ryhmänjohtajaltasi ' +
      'kuittia vastaan tai voit noutaa sen PitVan kololta sopimalla ajankohdan kalustonhoitajan kanssa.',
  },
  {
    name: 'PitVa-lippalakki',
    category: 'pitva-tuotteet',
    priceCents: 1000,
    stock: 27,
    description:
      'Sininen lippalakki, edessä 60 mm brodeerattu valkoinen PitVa-logo. ' +
      'Osta taatusti Espoon metsäuskottavin lippalakki! Saat lippalakin kokouksessa ' +
      'ryhmänjohtajaltasi kuittia vastaan tai voit noutaa sen PitVan kololta sopimalla ' +
      'ajankohdan kalustonhoitajan kanssa.',
  },
  {
    name: 'PitVa-kangaskassi',
    category: 'pitva-tuotteet',
    priceCents: 700,
    stock: 98,
    description:
      'Westford Millin valmistama laivastonsininen kangaskassi (38 x 42 cm), ' +
      'keskellä 20 cm kokoinen painettu valkoinen PitVa-logo. Osta PitVa-kangaskassi, ' +
      'joka sopii niin arkeen kuin retkille ja leireillekin! Saat kangaskassin kokouksessa ' +
      'ryhmänjohtajaltasi kuittia vastaan tai voit noutaa sen PitVan kololta sopimalla ' +
      'ajankohdan kalustonhoitajan kanssa.',
  },
  {
    name: 'PitVa-pipo ja -kangaskassi',
    category: 'pitva-tuotteet',
    priceCents: 2000,
    stock: null,
    description:
      'Laivastonsininen pipo, jonka päärmeessä 60 mm brodeerattu valkoinen PitVa-logo, ' +
      'sekä Westford Millin valmistama laivastonsininen kangaskassi (38 x 42 cm), jonka ' +
      'keskellä 20 cm kokoinen painettu valkoinen PitVa-logo. Nyt Espoon metsäuskottavin ' +
      'pipo ja kangaskassi samassa paketissa! Saat tuotteet kokouksessa ryhmänjohtajaltasi ' +
      'kuittia vastaan tai voit noutaa ne PitVan kololta sopimalla ajankohdan kalustonhoitajan kanssa.',
  },
  {
    name: 'Kaksi PitVa-kangaskassia',
    category: 'pitva-tuotteet',
    priceCents: 1200,
    stock: null,
    description:
      'Westford Millin valmistama laivastonsininen kangaskassi (38 x 42 cm), ' +
      'keskellä 20 cm kokoinen painettu valkoinen PitVa-logo. Osta PitVa-kangaskassi, ' +
      'joka sopii niin arkeen kuin retkille ja leireillekin! Saat kangaskassit kokouksessa ' +
      'ryhmänjohtajaltasi kuittia vastaan tai voit noutaa ne kololta sopimalla ajankohdan ' +
      'kalustonhoitajan kanssa.',
  },
  {
    name: 'ILovePitVa huppari - Aikuiset',
    category: 'pitva-tuotteet',
    priceCents: 4200,
    stock: null,
    description:
      'ILovePitVa-huppari aikuisille. Uusi mallisto! Valitse hupparin koko ostoskorissa.',
    questions: [
      {
        prompt: 'Hupparin koko',
        type: 'RADIO' as const,
        required: true,
        options: ['S', 'M', 'L', 'XL', 'XXL'],
      },
    ],
  },
  {
    name: 'ILovePitVa huppari - Lapset',
    category: 'pitva-tuotteet',
    priceCents: 3900,
    stock: null,
    description: 'ILovePitVa-huppari lapsille. Uusi mallisto! Valitse hupparin koko ostoskorissa.',
    questions: [
      {
        prompt: 'Hupparin koko',
        type: 'RADIO' as const,
        required: true,
        options: ['116', '128', '140', '152', '164'],
      },
    ],
  },
  {
    name: 'PitVa nimikyltti',
    category: 'pitva-tuotteet',
    priceCents: 800,
    stock: null,
    description: 'Ennakkotilatun PitVa-nimikyltin maksu. Kerro kyltin teksti ostoskorissa.',
    questions: [
      {
        prompt: 'Mitä tekstiä nimikylttiin (esim. "Aatu Vaelta")?',
        type: 'TEXT' as const,
        required: true,
        options: [],
      },
    ],
  },

  // --- Tapahtumat ---
  {
    name: 'Sudenpentuosaston retki 28.-29.11.2026',
    category: 'tapahtumat',
    priceCents: 1500,
    stock: null,
    isEvent: true,
    startsAt: new Date('2026-11-28'),
    endsAt: new Date('2026-11-29'),
    description:
      'Ostamalla tämän tuotteen ilmoitat lapsesi mukaan sudenpentuosaston retkelle ' +
      '28.-29.11. Retki järjestetään PitVan omalla kämpällä, Kammilla.',
  },
  {
    name: 'Johtajistoretki 29.-31.1.2027',
    category: 'tapahtumat',
    priceCents: 2500,
    stock: null,
    isEvent: true,
    startsAt: new Date('2027-01-29'),
    endsAt: new Date('2027-01-31'),
    description:
      'Ostamalla tämän tuotteen ilmoittaudut mukaan PitVan johtajistoretkelle 29.-31.1.2027.',
  },
  {
    name: 'Soturisopulien ja Pikkuoravien maasto-retki 14.-15.11.',
    category: 'tapahtumat',
    priceCents: 1500,
    stock: null,
    isEvent: true,
    startsAt: new Date('2026-11-14'),
    endsAt: new Date('2026-11-15'),
    description:
      'Ostamalla tämän tuotteen ilmoitat lapsesi mukaan Soturisopulien ja ' +
      'Pikkuoravien maastoretkelle.',
  },

  // --- Huivit ja merkit ---
  {
    name: 'Partiopaidan merkkipaketti',
    category: 'huivit-ja-merkit',
    priceCents: 1000,
    stock: null,
    description:
      'Merkkipaketti sisältää PitVassa käytössä olevat partiopaidan perusmerkit: ' +
      'maatunnus, paikkakuntatunnus, Suomen Partiolaisten tunnus, Järvi-Espoon ' +
      'Eräpartiolaisten merkki ja PitVan lippukuntamerkki. Saat merkkipaketin kokouksessa ' +
      'ryhmänjohtajaltasi kuittia vastaan. Huom! Uudet jäsenet saavat ensimmäisen ' +
      'merkkipakettinsa automaattisesti liittymismaksua vastaan.',
  },
  {
    name: 'Pitva-huivi, heijastava painatus',
    category: 'huivit-ja-merkit',
    priceCents: 1500,
    stock: 61,
    imageUrl:
      'https://cdn.holvi.com/media/poolimage.image/2013/09/16/0d8ef95a77fa5149f4eb909c1206a794ccd5d328_1100x1100_q85.gif',
    description:
      'Tilaa ja maksa Pitkäjärven Vaeltajien huivi. Vuoden 2019 mallissa logo on ' +
      'painettu heijastinvärillä. Saat huivin kokouksessa ryhmänjohtajaltasi kuittia vastaan. ' +
      'Huom! Uudet jäsenet saavat ensimmäisen PitVa-huivinsa automaattisesti liittymismaksua vastaan.',
  },
];

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
      },
      create: category,
    });
    console.log(`Kategoria: ${category.name}`);
  }

  for (const item of items) {
    const category = await prisma.category.findUniqueOrThrow({
      where: { slug: item.category },
    });
    const slug = item.name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const event = item as {
      isEvent?: boolean;
      startsAt?: Date;
      endsAt?: Date;
      imageUrl?: string;
    };
    const eventFields = {
      isEvent: event.isEvent ?? false,
      startsAt: event.startsAt ?? null,
      endsAt: event.endsAt ?? null,
    };
    const upserted = await prisma.item.upsert({
      where: { slug },
      update: {
        name: item.name,
        description: item.description,
        stock: item.stock ?? null,
        imageUrl: event.imageUrl ?? null,
        categoryId: category.id,
        ...eventFields,
      },
      create: {
        name: item.name,
        slug,
        description: item.description,
        stock: item.stock ?? null,
        imageUrl: event.imageUrl ?? null,
        categoryId: category.id,
        ...eventFields,
      },
    });

    const variantCount = await prisma.itemVariant.count({ where: { itemId: upserted.id } });
    if (variantCount === 0) {
      await prisma.itemVariant.create({
        data: { itemId: upserted.id, name: null, priceCents: item.priceCents, sortOrder: 0 },
      });
    }

    // Checkout questions are only seeded when the item has none yet, so
    // admin-edited questions survive re-seeding.
    const questions = (
      item as {
        questions?: { prompt: string; type: string; required: boolean; options: string[] }[];
      }
    ).questions;
    if (questions && questions.length > 0) {
      const existingCount = await prisma.itemQuestion.count({ where: { itemId: upserted.id } });
      if (existingCount === 0) {
        await prisma.itemQuestion.createMany({
          data: questions.map((q, index) => ({
            itemId: upserted.id,
            prompt: q.prompt,
            type: q.type as 'TEXT' | 'NUMBER' | 'RADIO' | 'CHECKBOX',
            required: q.required,
            options: q.options,
            sortOrder: index,
          })),
        });
      }
    }
    console.log(`Tuote: ${item.name}`);
  }

  // The built-in leaders' discount code. Only this code discounts events whose
  // "johtajien alennus" is turned on. Created once; admin edits it afterwards.
  await prisma.discountCode.upsert({
    where: { code: LEADER_DISCOUNT_CODE },
    update: { leaderOnly: true },
    create: {
      code: LEADER_DISCOUNT_CODE,
      description:
        'Johtajien alennus tapahtumiin (50 %). Toimii vain johtajien alennus -tapahtumissa.',
      percentOff: LEADER_DISCOUNT_PERCENT,
      leaderOnly: true,
    },
  });
  console.log(`Alennuskoodi: ${LEADER_DISCOUNT_CODE}`);

  // Bootstrap admins: KAUPPA_BOOTSTRAP_ADMIN_EMAILS="a@domain, b@domain". Roles
  // otherwise live in the database and are managed under /admin/users.
  const bootstrapAdmins = (process.env.KAUPPA_BOOTSTRAP_ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  for (const email of bootstrapAdmins) {
    await prisma.user.upsert({
      where: { email },
      update: { role: 'SUPERADMIN' },
      create: { email, role: 'SUPERADMIN' },
    });
    console.log(`Pääylläpitäjä: ${email}`);
  }
  if (bootstrapAdmins.length === 0) {
    console.log(
      'Vinkki: aseta KAUPPA_BOOTSTRAP_ADMIN_EMAILS seedataksesi ensimmäisen ylläpitäjän ' +
        '(tai käytä pnpm db:admin sähköposti@esimerkki.fi).',
    );
  }
  console.log('Valmis! Katalogi on seedattu.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
