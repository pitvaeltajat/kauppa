import Link from 'next/link';
import { signOut } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/admin';
import { requireEventAdmin } from '@/lib/admin-guard';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Event admins and superadmins reach the admin area; others go to /login.
  const role = await requireEventAdmin();
  const superadmin = isSuperAdmin(role);

  // Section links. Event admins see only Tapahtumat; superadmins see all.
  const links = [
    { href: '/admin/events', label: 'Tapahtumat' },
    ...(superadmin
      ? [
          { href: '/admin', label: 'Tilaukset' },
          { href: '/admin/items', label: 'Tuotteet' },
          { href: '/admin/categories', label: 'Kategoriat' },
          { href: '/admin/users', label: 'Käyttäjät' },
          { href: '/admin/reports', label: 'Raportit' },
          { href: '/admin/payouts', label: 'Tilitykset' },
        ]
      : []),
  ];

  return (
    <div className="min-h-[60vh]">
      <div className="border-b bg-header text-header-foreground">
        <div className="container flex h-14 items-center justify-between gap-4">
          <span className="font-bold">Hallinta</span>
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
        {/* Section nav: scrolls horizontally on narrow screens instead of overflowing. */}
        <nav className="container flex gap-4 overflow-x-auto pb-2 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 text-header-foreground/80 hover:text-header-foreground hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="container pb-10">{children}</div>
    </div>
  );
}

