'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Category } from '@prisma/client';
import { saveItem } from '@/lib/actions/admin';
import { QUESTION_TYPES, type QuestionType } from '@/lib/questions';
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
  questions: {
    id: string;
    prompt: string;
    type: string;
    required: boolean;
    options: string[];
  }[];
};

type QuestionDraft = {
  key: string;
  prompt: string;
  type: QuestionType;
  required: boolean;
  optionsText: string;
};

function draftFromQuestion(question: ItemFormValues['questions'][number]): QuestionDraft {
  return {
    key: question.id,
    prompt: question.prompt,
    type: question.type as QuestionType,
    required: question.required,
    optionsText: question.options.join('\n'),
  };
}

function emptyDraft(): QuestionDraft {
  return { key: crypto.randomUUID(), prompt: '', type: 'TEXT', required: true, optionsText: '' };
}

export function ItemForm({ categories, item }: { categories: Category[]; item?: ItemFormValues }) {
  const [state, action, pending] = useActionState(saveItem, undefined);
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    item?.questions?.map(draftFromQuestion) ?? [],
  );

  function updateQuestion(key: string, patch: Partial<QuestionDraft>) {
    setQuestions((prev) => prev.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  }

  return (
    <form action={action} className="max-w-2xl space-y-5">
      {state?.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {item?.id && <input type="hidden" name="id" value={item.id} />}
      <input
        type="hidden"
        name="questions"
        value={JSON.stringify(
          questions.map((q) => ({
            prompt: q.prompt,
            type: q.type,
            required: q.required,
            optionsText: q.optionsText,
          })),
        )}
      />

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

      {/* Checkout questions */}
      <div className="space-y-3 rounded-md border bg-background p-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Kysymykset kassalla</Label>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setQuestions((prev) => [...prev, emptyDraft()])}
          >
            <Plus /> Lisää kysymys
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Ostaja vastaa näihin ostoskorissa ennen maksua (esim. hupparin koko tai nimikyltin
          teksti). Vastaukset tallentuvat tilaukselle.
        </p>
        {questions.length === 0 && (
          <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
            Ei kysymyksiä — tuote ostetaan suoraan ilman lisätietoja.
          </p>
        )}
        {questions.map((q, index) => (
          <div key={q.key} className="space-y-2 rounded-md border bg-card p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">{index + 1}.</span>
              <Input
                value={q.prompt}
                onChange={(e) => updateQuestion(q.key, { prompt: e.target.value })}
                placeholder="Kysymysteksti, esim. Hupparin koko"
                className="flex-1"
              />
              <Select
                value={q.type}
                onChange={(e) => updateQuestion(q.key, { type: e.target.value as QuestionType })}
                className="w-40"
              >
                {QUESTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type === 'TEXT' ? 'Teksti' : type === 'NUMBER' ? 'Numero' : type === 'RADIO' ? 'Valinta (yksi)' : 'Valinta (useita)'}
                  </option>
                ))}
              </Select>
              <button
                type="button"
                aria-label="Poista kysymys"
                className="text-muted-foreground transition-colors hover:text-destructive"
                onClick={() => setQuestions((prev) => prev.filter((x) => x.key !== q.key))}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={(e) => updateQuestion(q.key, { required: e.target.checked })}
                  className="size-4 accent-[hsl(244,51%,24%)]"
                />
                Pakollinen
              </label>
              {(q.type === 'RADIO' || q.type === 'CHECKBOX') && (
                <span className="text-xs text-muted-foreground">Valintakysymys on aina pakollinen.</span>
              )}
            </div>
            {(q.type === 'RADIO' || q.type === 'CHECKBOX') && (
              <Textarea
                rows={3}
                value={q.optionsText}
                onChange={(e) => updateQuestion(q.key, { optionsText: e.target.value })}
                placeholder={'Yksi vaihtoehto per rivi, esim.\nS\nM\nL'}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Tallennetaan…' : item ? 'Tallenna tuote' : 'Luo tuote'}
        </Button>
      </div>
    </form>
  );
}
