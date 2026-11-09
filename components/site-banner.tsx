const WEBSITE_URL = 'https://www.pitkajarvenvaeltajat.fi/';
const WEBSITE_LABEL = 'pitkajarvenvaeltajat.fi';
const CONTACT_EMAIL = 'info@pitkajarvenvaeltajat.fi';

/** Front-page banner: the troop identity, a short intro, and the contact
 * details (moved up from the footer). `imageUrl` is an optional background
 * photo set in admin; it fades into the banner so the dark text stays legible,
 * and without it the banner is a clean light band. */
export function SiteBanner({ imageUrl }: { imageUrl?: string | null }) {
  return (
    <section className="relative isolate overflow-hidden border-b bg-card">
      {imageUrl && (
        <>
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-cover bg-center"
            style={{ backgroundImage: `url("${imageUrl}")` }}
          />
          {/* Fade the photo toward the banner colour, top and bottom, so the
              navy text keeps enough contrast over any image. */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-b from-card/80 via-card/60 to-card"
          />
        </>
      )}

      <div className="container grid gap-8 py-10 md:grid-cols-[1fr_auto] md:items-start md:py-14">
        {/* Identity + intro */}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">
            Pitkäjärven Vaeltajat ry
          </h1>
          <p className="mt-2 max-w-xl text-sm text-foreground/75 md:text-base">
            Partiolippukunta Pitkäjärven Vaeltajien nettikauppa ja ilmoittautumisportaali. Täältä
            voit ostaa huiveja, merkkejä ja PitVa-tuotteita sekä ilmoittautua tapahtumiin.
            Tuotteet saat kokouksessa ryhmänjohtajaltasi tai noutamalla ne sovitusti kololta.
          </p>
        </div>

        {/* Contact columns */}
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm md:gap-x-10">
          <ContactField label="Web-sivusto">
            <BannerLink href={WEBSITE_URL}>{WEBSITE_LABEL}</BannerLink>
          </ContactField>
          <ContactField label="Yhteissähköposti">
            <BannerLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</BannerLink>
          </ContactField>
        </dl>
      </div>
    </section>
  );
}

function ContactField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-semibold uppercase tracking-wide text-foreground/55">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

function BannerLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noreferrer' : undefined}
      className="font-medium text-primary underline-offset-2 hover:underline"
    >
      {children}
    </a>
  );
}
