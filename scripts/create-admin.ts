#!/usr/bin/env node
// Creates/upgrades a user to SUPERADMIN by email:
//   pnpm db:admin etunimi@pitkajarvenvaeltajat.fi
// Event-admin roles are derived from the email domain on sign-in; SUPERADMIN
// is the manual grant, managed under /admin/users.

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
  update: { role: 'SUPERADMIN' },
  create: { email, role: 'SUPERADMIN' },
});

console.log(`${email} on nyt pääylläpitäjä. He voivat kirjautua Hallintaan heti — uusi istunto riittää.`);
await prisma.$disconnect();
