'use client';

import { useActionState } from 'react';
import { saveAccountingClass } from '@/lib/actions/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingPill } from '@/components/ui/loading-pill';

export function AccountingClassForm() {
  const [state, action, pending] = useActionState(saveAccountingClass, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
      <div className="min-w-60 flex-1 space-y-1.5">
        <Label htmlFor="accounting-class-name">Nimi</Label>
        <Input id="accounting-class-name" name="name" placeholder="esim. 4010 Varusteet" required />
      </div>
      <div className="w-28 space-y-1.5">
        <Label htmlFor="accounting-class-order">Järjestys</Label>
        <Input id="accounting-class-order" name="sortOrder" type="number" defaultValue="0" />
      </div>
      <Button type="submit" disabled={pending}>{pending ? <LoadingPill className="bg-current/25" /> : 'Lisää luokka'}</Button>
      {state?.error && <p className="basis-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
