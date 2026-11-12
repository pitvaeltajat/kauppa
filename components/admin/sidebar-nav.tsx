'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

type AdminLink = { href: string; label: string };

export function AdminSidebarNav({ superadmin }: { superadmin: boolean }) {
  const pathname = usePathname();
  const sections: { label: string; links: AdminLink[] }[] = [
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
            label: 'Kammi',
            links: [
              { href: '/admin/kammi', label: 'Varaukset' },
              { href: '/admin/kammi/asetukset', label: 'Asetukset' },
            ],
          },
          {
            label: 'Ylläpito',
            links: [
              { href: '/admin/accounting-classes', label: 'Kirjanpitoluokat' },
              { href: '/admin/asetukset', label: 'Asetukset' },
              { href: '/admin/users', label: 'Käyttäjät' },
            ],
          },
        ]
      : []),
  ];

  const isActive = (href: string) =>
    href === '/admin'
      ? pathname === '/admin'
      : href === '/admin/kammi'
        ? pathname === href ||
          (pathname.startsWith(`${href}/`) && !pathname.startsWith(`${href}/asetukset`))
        : pathname.startsWith(href);

  return (
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
  );
}
