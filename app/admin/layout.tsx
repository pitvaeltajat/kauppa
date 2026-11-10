import Link from 'next/link';
import { Store, LogOut } from 'lucide-react';
import { signOut } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/admin';
import { requireEventAdmin } from '@/lib/admin-guard';
import { AdminSidebarNav } from '@/components/admin/sidebar-nav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Event admins and superadmins reach the admin area; others go to /login.
  const role = await requireEventAdmin();
  const superadmin = isSuperAdmin(role);

  return (
    <div className="container flex flex-col gap-6 py-6 md:flex-row md:gap-8">
      {/* Admin sidebar. The navy bar on top is the shop's single nav; this side
          menu is the admin's, so the two no longer read as competing bars.
          On phones it lies flat as a horizontal scroll strip. */}
      <aside className="md:w-52 md:shrink-0">
        <div className="mb-3 hidden items-center gap-2 px-3 text-sm font-bold md:flex">
          Hallinta
        </div>
        <AdminSidebarNav superadmin={superadmin} />

        <div className="mt-2 flex gap-1 border-t pt-2 md:mt-3 md:flex-col md:gap-0.5 md:pt-3">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
          >
            <Store className="size-4" /> Takaisin Konttiin
          </Link>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/' });
            }}
          >
            <button
              type="submit"
              className="flex w-full shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-4" /> Kirjaudu ulos
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
