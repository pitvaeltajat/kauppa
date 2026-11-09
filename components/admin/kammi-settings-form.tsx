'use client';

import { useActionState } from 'react';
import { saveKammiSettings } from '@/lib/actions/kammi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoadingPill } from '@/components/ui/loading-pill';

export type KammiSettingsValues = {
  active: boolean;
  weekendScoutCents: number;
  weekendOtherCents: number;
  weekdayScoutCents: number;
  weekdayOtherCents: number;
  minNights: number;
  maxNights: number;
  keycode: string;
  instructions: string;
};

const euro = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

function PriceField({ id, label, cents }: { id: string; label: string; cents: number }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label} (€)</Label>
      <Input id={id} name={id} inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" defaultValue={euro(cents)} />
    </div>
  );
}

export function KammiSettingsForm({ settings }: { settings: KammiSettingsValues }) {
  const [state, action, pending] = useActionState(saveKammiSettings, undefined);

  return (
    <form action={action} className="max-w-2xl space-y-5">
      {state?.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="active"
          defaultChecked={settings.active}
          className="size-4 accent-[hsl(244,51%,24%)]"
        />
        Kammin verkkovaraus käytössä (näkyy Kammin sivulla)
      </label>

      <fieldset className="space-y-4 rounded-md border bg-background p-4">
        <legend className="px-1 text-sm font-semibold">Viikonloppu (pe–su, kiinteä hinta)</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <PriceField id="weekendScout" label="Partiolainen" cents={settings.weekendScoutCents} />
          <PriceField id="weekendOther" label="Muu varaaja" cents={settings.weekendOtherCents} />
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-md border bg-background p-4">
        <legend className="px-1 text-sm font-semibold">Arkivuorokausi (€/yö)</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <PriceField id="weekdayScout" label="Partiolainen" cents={settings.weekdayScoutCents} />
          <PriceField id="weekdayOther" label="Muu varaaja" cents={settings.weekdayOtherCents} />
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="minNights">Vähimmäisyöt</Label>
          <Input id="minNights" name="minNights" type="number" min="1" step="1" defaultValue={settings.minNights} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="maxNights">Enimmäisyöt</Label>
          <Input id="maxNights" name="maxNights" type="number" min="1" step="1" defaultValue={settings.maxNights} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="keycode">Ovikoodi</Label>
        <Input id="keycode" name="keycode" defaultValue={settings.keycode} placeholder="esim. 1234" />
        <p className="text-xs text-muted-foreground">Lähetetään vain maksaneelle vahvistusviestissä. Ei näy julkisilla sivuilla.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="instructions">Ohjeet vahvistusviestiin</Label>
        <Textarea id="instructions" name="instructions" rows={6} defaultValue={settings.instructions} placeholder="Ajo-ohjeet, avaimet, siivous, palautus…" />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? <LoadingPill className="bg-current/25" /> : 'Tallenna asetukset'}
      </Button>
    </form>
  );
}
