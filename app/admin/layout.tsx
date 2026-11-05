import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, signOut } from '@/lib/auth';
import { isAdminUser } from '@/lib/admin';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const email = session?.user?.email ?? null;

  // Roles live in the database — an admin is a User row with role ADMIN.
  if (!email || !(await isAdminUser(email))) {
    redirect(`/login?callbackUrl=${encodeURIComponent('/admin')}`);
  }

  return (
    <div className="min-h-[60vh]">
      <div className="border-b bg-header text-header-foreground">
        <div className="container flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <span className="font-bold">Hallinta</span>
            <nav className="flex items-center gap-4 text-sm">
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

