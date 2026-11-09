export function SiteFooter() {
  return (
    <footer className="mt-12 border-t bg-card">
      <div className="container flex flex-col gap-6 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="font-semibold text-foreground">Pitkäjärven Vaeltajat ry</p>
          <p>Kysymykset tuotteista ja tilauksista: info@pitkajarvenvaeltajat.fi</p>
          <a
            href="https://www.pitkajarvenvaeltajat.fi/"
            target="_blank"
            rel="noreferrer"
            className="inline-block underline-offset-2 hover:underline"
          >
            pitkajarvenvaeltajat.fi
          </a>
        </div>
      </div>
    </footer>
  );
}
