#!/usr/bin/env node
// Creates/upgrades a user to SUPERADMIN by email:
//   pnpm db:admin etunimi@pitkajarvenvaeltajat.fi
// Event-admin roles are derived from the email domain on sign-in; SUPERADMIN
// is the manual grant, managed under /admin/users.

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { resolveToPrimaryEmail } from '@/lib/googleWorkspace';

const prisma = new PrismaClient();

const typed = process.argv[2]?.trim().toLowerCase();
if (!typed || !typed.includes('@')) {
  console.error('Anna sähköpostiosoite: pnpm db:admin etunimi@pitkajarvenvaeltajat.fi');
  process.exit(1);
}

// Google hands back the primary address at login, so the grant must land on the
// primary - not an alias someone happened to type. Resolve it; if Workspace
// creds are missing locally, warn and fall back to the typed address.
let email = typed;
try {
  email = await resolveToPrimaryEmail(typed);
  if (email !== typed) console.log(`${typed} on alias → käytetään ensisijaista osoitetta ${email}.`);
} catch (error) {
  console.warn(
    `VAROITUS: aliaksen tarkistus Workspacesta epäonnistui (${(error as Error).message}). ` +
      `Käytetään annettua osoitetta sellaisenaan - varmista että se on ensisijainen osoite.`,
  );
}

await prisma.user.upsert({
  where: { email },
  update: { role: 'SUPERADMIN' },
  create: { email, role: 'SUPERADMIN' },
});

console.log(`${email} on nyt pääylläpitäjä. He voivat kirjautua Hallintaan heti. Uusi istunto riittää.`);
await prisma.$disconnect();
