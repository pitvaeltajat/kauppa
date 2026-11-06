import Link from 'next/link';
import { signOut } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/admin';
import { requireEventAdmin } from '@/lib/admin-guard';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Event admins and superadmins reach the admin area; others go to /login.
  const role = await requireEventAdmin();
  const superadmin = isSuperAdmin(role);

  return (
    <div className="min-h-[60vh]">
      <div className="border-b bg-header text-header-foreground">
        <div className="container flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <span className="font-bold">Hallinta</span>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/admin/events" className="text-header-foreground/80 hover:text-header-foreground hover:underline">
                Tapahtumat
              </Link>
              {superadmin && (
                <>
                  <Link href="/admin" className="text-header-foreground/80 hover:text-header-foreground hover:underline">
                    Tilaukset
                  </Link>
                  <Link href="/admin/items" className="text-header-foreground/80 hover:text-header-foreground hover:underline">
                    Tuotteet
                  </Link>
                  <Link href="/admin/categories" className="text-header-foreground/80 hover:text-header-foreground hover:underline">
                    Kategoriat
                  </Link>
                  <Link href="/admin/users" className="text-header-foreground/80 hover:text-header-foreground hover:underline">
                    Käyttäjät
                  </Link>
                  <Link href="/admin/reports" className="text-header-foreground/80 hover:text-header-foreground hover:underline">
                    Raportit
                  </Link>
                  <Link href="/admin/payouts" className="text-header-foreground/80 hover:text-header-foreground hover:underline">
                    Tilitykset
                  </Link>
                </>
              )}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-4 text-sm">
            <Link href="/" className="text-header-foreground/80 hover:text-header-foreground hover:underline">
              Takaisin kauppaan
            </Link>
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/' });
              }}
            >
              <button type="submit" className="text-header-foreground/80 hover:text-header-foreground hover:underline">
                Kirjaudu ulos
              </button>
            </form>
          </div>
        </div>
      </div>
      <div className="container pb-10">{children}</div>
    </div>
  );
}

