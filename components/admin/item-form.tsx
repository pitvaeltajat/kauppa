'use client';

import { useActionState } from 'react';
import type { Category } from '@prisma/client';
import { saveItem } from '@/lib/actions/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';

export type ItemFormValues = {
  id?: string;
  name: string;
  slug: string;
  categoryId: string;
  priceCents: number;
  stock: number | null;
  imageUrl: string | null;
  description: string;
  sortOrder: number;
  active: boolean;
};

export function ItemForm({ categories, item }: { categories: Category[]; item?: ItemFormValues }) {
  const [state, action, pending] = useActionState(saveItem, undefined);

  return (
    <form action={action} className="max-w-2xl space-y-5">
      {state?.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {item?.id && <input type="hidden" name="id" value={item.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nimi *</Label>
          <Input id="name" name="name" required defaultValue={item?.name ?? ''} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="slug">Slug (URL-osio)</Label>
          <Input
            id="slug"
            name="slug"
            defaultValue={item?.slug ?? ''}
            placeholder="Muodostetaan nimestä"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="categoryId">Kategoria *</Label>
          <Select id="categoryId" name="categoryId" defaultValue={item?.categoryId ?? categories[0]?.id}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="price">Hinta (€) *</Label>
          <Input
            id="price"
            name="price"
            required
            inputMode="decimal"
            defaultValue={item ? (item.priceCents / 100).toFixed(2).replace('.', ',') : ''}
            placeholder="16,00"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="stock">Varastossa (kpl)</Label>
          <Input
            id="stock"
            name="stock"
            inputMode="numeric"
            defaultValue={item?.stock?.toString() ?? ''}
            placeholder="Tyhjä = rajoittamaton"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sortOrder">Järjestysnumero</Label>
          <Input
            id="sortOrder"
            name="sortOrder"
            inputMode="numeric"
            defaultValue={item?.sortOrder ?? 0}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="imageUrl">Kuvan URL</Label>
        <Input
          id="imageUrl"
          name="imageUrl"
          defaultValue={item?.imageUrl ?? ''}
          placeholder="https://… tai tyhjä (näytetään Ei kuvaa)"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Kuvaus</Label>
        <Textarea
          id="description"
          name="description"
          rows={6}
          defaultValue={item?.description ?? ''}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={item?.active ?? true}
          className="size-4 accent-[hsl(244,51%,24%)]"
        />
        Näkyy kaupassa
      </label>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Tallennetaan…' : item ? 'Tallenna tuote' : 'Luo tuote'}
        </Button>
      </div>
    </form>
  );
}
