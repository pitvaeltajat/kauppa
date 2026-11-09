'use client';

import { useActionState } from 'react';
import { saveCategory } from '@/lib/actions/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export type CategoryFormValues = {
  id?: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
};

export function CategoryForm({ category }: { category?: CategoryFormValues }) {
  const [state, action, pending] = useActionState(saveCategory, undefined);

  return (
    <form action={action} className="max-w-2xl space-y-5">
      {state?.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {category?.id && <input type="hidden" name="id" value={category.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nimi *</Label>
          <Input id="name" name="name" required defaultValue={category?.name ?? ''} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="slug">Tunnus URL-osoitteessa</Label>
          <Input
            id="slug"
            name="slug"
            defaultValue={category?.slug ?? ''}
            placeholder="muodostetaan-nimesta"
            spellCheck={false}
            autoCapitalize="none"
            aria-describedby="slug-help"
          />
          <p id="slug-help" className="text-xs text-muted-foreground">
            Kategorian osoite: <span className="font-mono">/category/{'{slug}'}</span>. Jätä tyhjäksi,
            niin tunnus muodostetaan nimestä. Käytä pieniä kirjaimia, numeroita ja väliviivoja
            (ä→a, ö→o).
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sortOrder">Järjestysnumero</Label>
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            step="1"
            inputMode="numeric"
            defaultValue={category?.sortOrder ?? 0}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Kuvaus</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={category?.description ?? ''}
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Tallennetaan…' : category ? 'Tallenna kategoria' : 'Luo kategoria'}
      </Button>
    </form>
  );
}
