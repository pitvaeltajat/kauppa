// Admin authorization. Roles live in the database and are derived on sign-in
// (lib/auth.ts): a pitva-domain Google account is EVENT_ADMIN, everyone else is
// USER. SUPERADMIN is the one manual grant (set under /admin/users, or
// bootstrapped with `pnpm db:seed` / `pnpm db:admin <email>`).
//
//   SUPERADMIN  : full access: orders, all items, categories, users, reports,
//                 payouts, plus everything an event admin can do.
//   EVENT_ADMIN : events only: create / edit / hide events.
//   USER        : no admin access (parents never need to log in at all).

import { prisma } from '@/lib/prisma';

export type Role = 'USER' | 'EVENT_ADMIN' | 'SUPERADMIN';

/** Current role of a User row, or null when the user has never signed in. */
export async function getUserRole(email: string | null | undefined): Promise<Role | null> {
  if (!email) return null;
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  return (user?.role as Role) ?? null;
}

/** Can reach the admin area at all (event admin or superadmin). */
export function isEventAdmin(role: Role | null | undefined): boolean {
  return role === 'EVENT_ADMIN' || role === 'SUPERADMIN';
}

/** Full access to every admin screen and setting. */
export function isSuperAdmin(role: Role | null | undefined): boolean {
  return role === 'SUPERADMIN';
}

/**
 * The role a signing-in person should have, derived from their email domain.
 * A standing SUPERADMIN is preserved (never auto-downgraded); a pitva-domain
 * address is an EVENT_ADMIN; everyone else is a plain USER.
 */
export function deriveRole(email: string, currentRole: Role | null): Role {
  if (currentRole === 'SUPERADMIN') return 'SUPERADMIN';
  const domain = (process.env.GOOGLE_WORKSPACE_DOMAIN || process.env.KAUPPA_DEV_DOMAIN || '')
    .trim()
    .toLowerCase();
  if (domain && email.trim().toLowerCase().endsWith(`@${domain}`)) return 'EVENT_ADMIN';
  return 'USER';
}

export function isDevLoginEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.KAUPPA_DEV_LOGIN === '1';
}
