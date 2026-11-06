import Link from 'next/link';
import type { Category } from '@prisma/client';
import { CartButton } from '@/components/cart-button';
import { isEventAdmin, isSuperAdmin, type Role } from '@/lib/admin';

export function SiteHeader({ categories, role }: { categories: Category[]; role?: string }) {
  const r = (role ?? null) as Role | null;
  const showAdmin = isEventAdmin(r); // event admins + superadmins
  const showUsers = isSuperAdmin(r); // superadmins only
  return (
    <header className="sticky top-0 z-40 border-b bg-header text-header-foreground shadow-sm">
      <div className="container flex h-14 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-bold tracking-tight">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-cta text-sm font-black text-header">
              P
            </span>
            <span className="truncate text-sm md:text-base">Pitkäjärven Vaeltajat · kauppa</span>
          </Link>
          <nav className="hidden items-center gap-4 md:flex">
            <Link href="/" className="text-sm text-header-foreground/80 hover:text-header-foreground hover:underline">
              Etusivu
            </Link>
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/category/${category.slug}`}
                className="text-sm text-header-foreground/80 hover:text-header-foreground hover:underline"
              >
                {category.name}
              </Link>
            ))}
            {showAdmin && (
              <Link
                href="/admin"
                className="text-sm font-semibold text-cta hover:underline"
              >
                Hallinta
              </Link>
            )}
            {showUsers && (
              <Link
                href="/admin/users"
                className="text-sm text-header-foreground/80 hover:text-header-foreground hover:underline"
              >
                Käyttäjät
              </Link>
            )}
          </nav>
        </div>
        <CartButton />
      </div>
      {/* Mobile category strip */}
      <nav className="container flex gap-3 overflow-x-auto pb-2 md:hidden">
        <Link href="/" className="shrink-0 text-xs text-header-foreground/80 hover:underline">
          Etusivu
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/category/${category.slug}`}
            className="shrink-0 text-xs text-header-foreground/80 hover:underline"
          >
            {category.name}
          </Link>
        ))}
        {showAdmin && (
          <Link href="/admin" className="shrink-0 text-xs font-semibold text-cta hover:underline">
            Hallinta
          </Link>
        )}
        {showUsers && (
          <Link href="/admin/users" className="shrink-0 text-xs text-header-foreground/80 hover:underline">
            Käyttäjät
          </Link>
        )}
      </nav>
    </header>
  );
}
