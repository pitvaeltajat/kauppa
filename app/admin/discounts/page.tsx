import type { Metadata } from 'next';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { fi } from 'date-fns/locale';
import { prisma } from '@/lib/prisma';
import { deleteDiscount } from '@/lib/actions/admin';
import { requireSuperAdmin } from '@/lib/admin-guard';
import { ButtonLink } from '@/components/ui/button-link';
import { Badge } from '@/components/ui/badge';
import { FormButton } from '@/components/admin/form-button';
import { LEADER_DISCOUNT_CODE } from '@/lib/discount';

export const metadata: Metadata = { title: 'Alennuskoodit' };

export default async function AdminDiscountsPage() {
  await requireSuperAdmin();
  const codes = await prisma.discountCode.findMany({
    orderBy: [{ active: 'desc' }, { code: 'asc' }],
  });
  const now = new Date();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Alennuskoodit ({codes.length})</h1>
        <ButtonLink href="/admin/discounts/new" variant="cta">
          <Plus /> Uusi koodi
        </ButtonLink>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Ostaja syöttää koodin ostoskorissa. &quot;Vain johtajien alennus&quot; -koodi alentaa vain
        tapahtumia, joissa johtajien alennus on päällä.
      </p>
      <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
        <p className="font-semibold">JOHTAJA-koodin käyttö</p>
        <p className="mt-1 text-muted-foreground">
          JOHTAJA antaa 50 % alennuksen vain tapahtumille, joissa tuotteen asetuksissa on päällä
          <span className="font-medium text-foreground"> Johtajien alennus</span>. Kun luot tai
          muokkaat tällaista tapahtumaa, varmista asetus. Ostaja kirjoittaa ostoskorissa koodin
          <span className="font-mono font-semibold text-foreground"> JOHTAJA</span> ja painaa Käytä.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Koodi on järjestelmän lukitsema: sitä ei voi muuttaa, poistaa tai sulkea tältä sivulta.
        </p>
      </div>

      <div className="space-y-3">
        {codes.length === 0 && (
          <p className="rounded-lg border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            Ei alennuskoodeja. Luo ensimmäinen!
          </p>
        )}
        {codes.map((code) => {
          const expired = code.validUntil && code.validUntil < now;
          const immutable = code.code === LEADER_DISCOUNT_CODE;
          return (
            <div
              key={code.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 shadow-sm"
            >
              <div>
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  <span className="font-mono">{code.code}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    −{code.percentOff} %
                  </span>
                  {code.leaderOnly && <Badge variant="secondary">Johtajien alennus</Badge>}
                  {immutable && <Badge variant="secondary">Lukittu järjestelmäkoodi</Badge>}
                  {!code.active && <Badge variant="secondary">Pois käytöstä</Badge>}
                  {expired && <Badge variant="destructive">Vanhentunut</Badge>}
                </p>
                {code.description && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{code.description}</p>
                )}
                {code.validUntil && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Voimassa {format(code.validUntil, 'd.M.yyyy', { locale: fi })} asti
                  </p>
                )}
              </div>
              {immutable ? (
                <span className="text-sm text-muted-foreground">Järjestelmän käytössä</span>
              ) : (
                <div className="flex gap-2">
                  <ButtonLink href={`/admin/discounts/${code.id}`} size="sm" variant="outline">
                    Muokkaa
                  </ButtonLink>
                  <form action={deleteDiscount}>
                    <input type="hidden" name="id" value={code.id} />
                    <FormButton
                      size="sm"
                      variant="ghost"
                      confirm={`Poista koodi "${code.code}"? Tätä ei voi perua.`}
                    >
                      Poista
                    </FormButton>
                  </form>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
