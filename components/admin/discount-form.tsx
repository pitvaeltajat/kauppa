'use client';

import { useActionState } from 'react';
import { saveDiscount } from '@/lib/actions/admin';
import { LEADER_DISCOUNT_CODE, LEADER_DISCOUNT_PERCENT } from '@/lib/discount';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoadingPill } from '@/components/ui/loading-pill';

export type DiscountFormValues = {
  id?: string;
  code: string;
  description: string;
  percentOff: number;
  active: boolean;
  /** "YYYY-MM-DD" for the native date input, or null. */
  validUntil: string | null;
};

export function DiscountForm({ discount }: { discount?: DiscountFormValues }) {
  const [state, action, pending] = useActionState(saveDiscount, undefined);

  return (
    <form action={action} className="max-w-2xl space-y-5">
      {state?.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {discount?.id && <input type="hidden" name="id" value={discount.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="code">Koodi *</Label>
          <Input
            id="code"
            name="code"
            required
            defaultValue={discount?.code ?? LEADER_DISCOUNT_CODE}
            placeholder="JOHTAJA"
            spellCheck={false}
            autoCapitalize="characters"
            className="font-mono uppercase"
          />
          <p className="text-xs text-muted-foreground">
            Ostaja kirjoittaa tämän ostoskorissa. Isot kirjaimet ja numerot.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="percentOff">Alennus (%) *</Label>
          <Input
            id="percentOff"
            name="percentOff"
            type="number"
            min="1"
            max="100"
            step="1"
            inputMode="numeric"
            required
            defaultValue={discount?.percentOff ?? LEADER_DISCOUNT_PERCENT}
            placeholder={String(LEADER_DISCOUNT_PERCENT)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Kuvaus (vain hallinnassa)</Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={discount?.description ?? ''}
          placeholder="Esim. Johtajien alennus tapahtumiin."
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="validUntil">Voimassa asti (valinnainen)</Label>
        <Input
          id="validUntil"
          name="validUntil"
          type="date"
          defaultValue={discount?.validUntil ?? ''}
        />
        <p className="text-xs text-muted-foreground">Tyhjä = ei päättymispäivää.</p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={discount?.active ?? true}
          className="size-4 accent-[hsl(244,51%,24%)]"
        />
        Käytössä
      </label>

      <Button type="submit" disabled={pending}>
        {pending ? <LoadingPill className="bg-current/25" /> : discount ? 'Tallenna koodi' : 'Luo koodi'}
      </Button>
    </form>
  );
}
