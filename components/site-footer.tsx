import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t bg-card">
      <div className="container flex flex-col gap-6 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="font-semibold text-foreground">Pitkäjärven Vaeltajat ry</p>
          <p>Kysymykset tuotteista ja tilauksista: info@pitkajarvenvaeltajat.fi</p>
          <p>Laskutus: laskutus@pitkajarvenvaeltajat.fi</p>
          <a
            href="https://www.pitkajarvenvaeltajat.fi/"
            target="_blank"
            rel="noreferrer"
            className="inline-block underline-offset-2 hover:underline"
          >
            pitkajarvenvaeltajat.fi
          </a>
        </div>
        {/* Backlink to the front door, same pattern as Klapi and Budu. */}
        <Link
          href="https://atk.pitva.fi"
          className="flex items-center gap-3 rounded-lg border bg-background px-4 py-3 text-header shadow-sm transition-colors hover:border-header/40"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded bg-header text-lg text-header-foreground">
            🪵
          </span>
          <span>
            <span className="block text-xs font-medium">PitVan palvelut</span>
            <span className="block text-xs opacity-70">atk.pitva.fi</span>
          </span>
        </Link>
      </div>
    </footer>
  );
}
