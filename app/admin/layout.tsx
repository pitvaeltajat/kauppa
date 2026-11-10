import Link from 'next/link';
import { headers } from 'next/headers';
import { Store, LogOut } from 'lucide-react';
import { signOut } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/admin';
import { requireEventAdmin } from '@/lib/admin-guard';
import { cn } from '@/lib/cn';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Event admins and superadmins reach the admin area; others go to /login.
  const role = await requireEventAdmin();
  const superadmin = isSuperAdmin(role);

  // Grouping keeps content, shop operations, and administration distinct.
  // Event admins only see the content section they can access.
  const sections = [
    {
      label: 'Sisältö',
      links: [
        { href: '/admin/events', label: 'Tapahtumat' },
        ...(superadmin
          ? [
              { href: '/admin/items', label: 'Tuotteet' },
              { href: '/admin/categories', label: 'Kategoriat' },
            ]
          : []),
      ],
    },
    ...(superadmin
      ? [
          {
            label: 'Kauppa',
            links: [
              { href: '/admin', label: 'Tilaukset' },
              { href: '/admin/discounts', label: 'Alennuskoodit' },
              { href: '/admin/payouts', label: 'Tilitykset' },
              { href: '/admin/reports', label: 'Raportit' },
            ],
          },
          {
            label: 'Ylläpito',
            links: [
              { href: '/admin/kammi', label: 'Kammi' },
              { href: '/admin/asetukset', label: 'Asetukset' },
              { href: '/admin/users', label: 'Käyttäjät' },
            ],
          },
        ]
      : []),
  ];

  const pathname = (await headers()).get('x-pathname') ?? '';
  // "/admin" is Tilaukset, so it matches exactly; the others own their subtree.
  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  return (
    <div className="container flex flex-col gap-6 py-6 md:flex-row md:gap-8">
      {/* Admin sidebar. The navy bar on top is the shop's single nav; this side
          menu is the admin's, so the two no longer read as competing bars.
          On phones it lies flat as a horizontal scroll strip. */}
      <aside className="md:w-52 md:shrink-0">
        <div className="mb-3 hidden items-center gap-2 px-3 text-sm font-bold md:flex">
          Hallinta
        </div>
        <nav className="flex gap-4 overflow-x-auto pb-1 md:block md:overflow-visible md:pb-0">
          {sections.map((section, sectionIndex) => (
            <div key={`${section.label}-${sectionIndex}`} className="shrink-0 md:mb-4 last:mb-0">
              <h2 className="mb-1 hidden px-3 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-muted-foreground md:block">
                {section.label}
              </h2>
              <div className="flex gap-1 md:flex-col md:gap-0.5">
                {section.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      'shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive(link.href)
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground/70 hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

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
