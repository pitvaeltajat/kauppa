import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getUserRole, isEventAdmin, isSuperAdmin, type Role } from '@/lib/admin';

/** Role of the signed-in person for an admin screen, or null. */
export async function adminRole(): Promise<Role | null> {
  const session = await auth();
  return getUserRole(session?.user?.email ?? null);
}

/** Guard for the admin area: event admins and superadmins pass. */
export async function requireEventAdmin(): Promise<Role> {
  const role = await adminRole();
  if (!isEventAdmin(role)) redirect(`/login?callbackUrl=${encodeURIComponent('/admin')}`);
  return role as Role;
}

/** Guard for superadmin-only screens: event admins are sent to their events. */
export async function requireSuperAdmin(): Promise<Role> {
  const role = await adminRole();
  if (!isEventAdmin(role)) redirect(`/login?callbackUrl=${encodeURIComponent('/admin')}`);
  if (!isSuperAdmin(role)) redirect('/admin/events');
  return role as Role;
}
