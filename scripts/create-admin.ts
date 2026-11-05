#!/usr/bin/env node
// Creates/upgrades a user to ADMIN by email:
//   pnpm db:admin etunimi@pitkajarvenvaeltajat.fi
// Roles otherwise live in the database and are managed under /admin/users.

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes('@')) {
  console.error('Anna sähköpostiosoite: pnpm db:admin etunimi@pitkajarvenvaeltajat.fi');
  process.exit(1);
}

await prisma.user.upsert({
  where: { email },
  update: { role: 'ADMIN' },
  create: { email, role: 'ADMIN' },
});

console.log(`${email} on nyt ylläpitäjä. He voivat kirjautua Hallintaan heti — uusi istunto riittää.`);
await prisma.$disconnect();
