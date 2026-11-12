import type { Metadata } from 'next';
import { Phone, Mail } from 'lucide-react';
import { formatCents } from '@/lib/money';
import { dayStatuses, labelsByDay } from '@/lib/kammi';
import { auth } from '@/lib/auth';
import { getUserRole, isSuperAdmin, isEventAdmin } from '@/lib/admin';
import { getKammiSettings, getBusyRanges, bookingWindow } from '@/lib/kammiBookings';
import { KammiBooking } from '@/components/kammi-booking';

export const metadata: Metadata = {
  title: 'Kammin varaus',
  description:
    'Tarkista Kammin vapaat päivät, varaa vuoro ja maksa verkossa. Saat ovikoodin sähköpostitse.',
};

export const dynamic = 'force-dynamic';

export default async function KammiPage() {
  const settings = await getKammiSettings();
  const { fromISO, toISO } = bookingWindow(6);

  const session = await auth();
  const role = await getUserRole(session?.user?.email ?? null);
  const superAdmin = isSuperAdmin(role);
  // Logged-in pitva members book scout stays free.
  const pitvaMember = isEventAdmin(role);

  // Not active: regular visitors get the notice; a superadmin still sees the
  // calendar below (with a preview banner) so they can preview before go-live.
  if (!settings.active && !superAdmin) {
    return (
      <div className="container py-12">
        <h1 className="text-2xl font-bold">Kammin varaus</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Kammin verkkovaraus ei ole tällä hetkellä käytössä. Ota yhteyttä kämppäisäntään.
        </p>
      </div>
    );
  }

  const busy = await getBusyRanges(fromISO, toISO);
  const statusMap = dayStatuses(busy, fromISO, toISO);
  const statuses: Record<string, { m: boolean; n: boolean }> = {};
  for (const [iso, s] of statusMap) statuses[iso] = { m: s.morningBusy, n: s.nightBusy };

  // Who holds each booked night - shown only to logged-in viewers.
  const labels = session?.user?.email ? labelsByDay(busy, fromISO, toISO) : {};

  return (
    <div className="container py-8">
      {!settings.active && superAdmin && (
        <p className="mb-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          Esikatselu: verkkovaraus ei ole vielä käytössä. Tämä näkymä näkyy vain pääylläpitäjille.
          Voit ottaa varauksen käyttöön kohdassa Hallinta → Kammi.
        </p>
      )}
      {settings.heroImageUrl && (
        <div
          className="relative mb-8 flex min-h-64 items-end overflow-hidden rounded-xl border bg-muted bg-cover bg-center shadow-sm sm:min-h-80"
          style={{
            backgroundImage: `linear-gradient(90deg, rgb(0 0 0 / 0.68), rgb(0 0 0 / 0.16)), url("${settings.heroImageUrl}")`,
          }}
        >
          <div className="relative max-w-xl p-6 text-white sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/80">
              Pitkäjärven vaeltajat
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Kammin varaus</h1>
            <p className="mt-3 text-sm leading-6 text-white/90 sm:text-base">
              Varaa oma vuorosi luonnon rauhaan.
            </p>
          </div>
        </div>
      )}
      {!settings.heroImageUrl && <h1 className="text-2xl font-bold">Kammin varaus</h1>}
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Tarkista kalenterista vapaat päivät ja valitse itsellesi sopiva vuoro. Varaus vahvistuu, kun
        maksu on suoritettu. Saat ovikoodin ja ohjeet sähköpostitse maksun jälkeen.
      </p>

      {/* Price list */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-4 text-sm shadow-sm">
          <p className="font-semibold">Viikonloppu (pe–su)</p>
          <p className="mt-1 text-muted-foreground">
            Partiolainen {formatCents(settings.weekendScoutCents)} · Muu varaaja{' '}
            {formatCents(settings.weekendOtherCents)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Viikonloppuhinta on sama, vaikka varaisit vain pe–la tai la–su. Toisen yön voi varata
            toinen seurue.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-sm shadow-sm">
          <p className="font-semibold">Arkivuorokausi</p>
          <p className="mt-1 text-muted-foreground">
            Partiolainen {formatCents(settings.weekdayScoutCents)}/yö · Muu varaaja{' '}
            {formatCents(settings.weekdayOtherCents)}/yö
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pidemmät varaukset sovitaan erikseen kämppäisännän kanssa.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <KammiBooking
          today={fromISO}
          windowEnd={toISO}
          statuses={statuses}
          prices={{
            weekendScoutCents: settings.weekendScoutCents,
            weekendOtherCents: settings.weekendOtherCents,
            weekdayScoutCents: settings.weekdayScoutCents,
            weekdayOtherCents: settings.weekdayOtherCents,
          }}
          minNights={settings.minNights}
          maxNights={settings.maxNights}
          pitvaMember={pitvaMember}
          labels={labels}
        />
      </div>

      <div className="mt-10 rounded-lg border bg-card p-5 text-sm shadow-sm">
        <p className="font-medium">Ehdot ja yhteystiedot</p>
        <p className="mt-2 text-muted-foreground">
          Varaaja huolehtii loppusiivouksesta. Jos siivous jää tekemättä, siitä veloitetaan
          erikseen. Varausasioissa auttaa kämppäisäntä.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Phone className="size-4" /> 044 9747446
          </span>
          <span className="flex items-center gap-1.5">
            <Mail className="size-4" /> paavali.keppo@pitkajarvenvaeltajat.fi
          </span>
        </div>
      </div>
    </div>
  );
}
