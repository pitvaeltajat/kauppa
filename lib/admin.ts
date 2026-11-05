// Admin authorization. Roles live in the database: there is no env-based
// allowlist anymore. A person is an admin only when a User row exists with
// role = ADMIN — bootstrap the first one with `pnpm db:seed` (see
// KAUPPA_BOOTSTRAP_ADMIN_EMAILS) or `pnpm db:admin <email>`, then manage roles
// under /admin/users.

import { prisma } from '@/lib/prisma';

/** True when a User row with this email has role ADMIN. */
export async function isAdminUser(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  return user?.role === 'ADMIN';
}

/** Current role of a User row, or null when the user has never signed in. */
export async function getUserRole(
  email: string | null | undefined,
): Promise<'ADMIN' | 'USER' | null> {
  if (!email) return null;
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  return user?.role ?? null;
}

export function isDevLoginEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.KAUPPA_DEV_LOGIN === '1';
}

