'use client';

import { useRef, useState } from 'react';
import { useActionState } from 'react';
import Link from 'next/link';
import { Plus, Trash2, Upload } from 'lucide-react';
import type { Category } from '@prisma/client';
import { saveItem } from '@/lib/actions/admin';
import { QUESTION_TYPES, type QuestionType } from '@/lib/questions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingPill } from '@/components/ui/loading-pill';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { ItemImage } from '@/components/item-image';
import { KuvatPicker } from '@/components/admin/kuvat-picker';

export type ItemFormValues = {
  id?: string;
  name: string;
  slug: string;
  categoryId: string;
  accountingClassId: string | null;
  priceCents: number;
  stock: number | null;
  imageUrl: string | null;
  description: string;
  sortOrder: number;
  active: boolean;
  featured: boolean;
  isEvent: boolean;
  /** "YYYY-MM-DD" for the native date inputs, or null. */
  startsAt: string | null;
  endsAt: string | null;
  hidden: boolean;
  leaderDiscount: boolean;
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

export function ItemForm({
  categories,
  accountingClasses,
  item,
  eventMode = false,
  returnHref = eventMode ? '/admin/events' : '/admin/items',
}: {
  categories: Category[];
  accountingClasses: { id: string; name: string }[];
  item?: ItemFormValues;
  /** Events-only form (used by event admins): locks isEvent on, hides the
   * category picker (events go to Tapahtumat automatically). */
  eventMode?: boolean;
  returnHref?: string;
}) {
  const [state, action, pending] = useActionState(saveItem, undefined);
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    item?.questions?.map(draftFromQuestion) ?? [],
  );
  const isEvent = eventMode;
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? '');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [startsAt, setStartsAt] = useState(item?.startsAt ?? '');
  const [endsAt, setEndsAt] = useState(item?.endsAt ?? '');

  function updateQuestion(key: string, patch: Partial<QuestionDraft>) {
    setQuestions((prev) => prev.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  }

  async function onPickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // let the same file be re-picked after a failure
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      // Ask the server for a presigned POST, then upload straight to S3.
      const signed = await fetch('/api/items/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type }),
      });
      if (!signed.ok) {
        const { error } = await signed.json().catch(() => ({ error: '' }));
        throw new Error(error || 'presign failed');
      }
      const { url, fields, publicUrl } = (await signed.json()) as {
        url: string;
        fields: Record<string, string>;
        publicUrl: string;
      };
      const body = new FormData();
      Object.entries(fields).forEach(([key, value]) => body.append(key, value));
      body.append('file', file);
      const uploaded = await fetch(url, { method: 'POST', body });
      if (!uploaded.ok) throw new Error('upload failed');
      setImageUrl(publicUrl);
    } catch {
      setUploadError(
        'Kuvan lataus epäonnistui. Tarkista tiedostomuoto (JPG/PNG/WebP) ja koko (enintään 10 MB).',
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={action} className="max-w-3xl space-y-6">
      {state?.error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Täytä perustiedot ja julkaisuasetukset. Tähdellä (*) merkityt kentät ovat pakollisia.
      </p>
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
          <Label htmlFor="slug">Tunnus URL-osoitteessa</Label>
          <Input
            id="slug"
            name="slug"
            defaultValue={item?.slug ?? ''}
            placeholder="muodostetaan-nimesta"
            spellCheck={false}
            autoCapitalize="none"
            aria-describedby="slug-help"
          />
          <p id="slug-help" className="text-xs text-muted-foreground">
            Tuotteen osoite: <span className="font-mono">/item/{'{slug}'}</span>. Jätä tyhjäksi,
            niin tunnus muodostetaan nimestä. Käytä pieniä kirjaimia, numeroita ja väliviivoja (ä→a,
            ö→o). Vanha osoite ohjautuu uuteen, jos muutat tunnusta.
          </p>
        </div>
      </div>

      {eventMode && <input type="hidden" name="eventMode" value="on" />}

      {isEvent && (
        <div className="space-y-4 rounded-md border bg-background p-4">
          <div>
            <h2 className="text-base font-semibold">Tapahtuman ajankohta</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Päättymispäivä voi olla sama kuin alkamispäivä.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="startsAt">Alkaa *</Label>
              <Input
                id="startsAt"
                name="startsAt"
                type="date"
                required
                value={startsAt}
                onChange={(e) => {
                  const next = e.target.value;
                  setStartsAt(next);
                  if (endsAt && next > endsAt) setEndsAt(next);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endsAt">Päättyy *</Label>
              <Input
                id="endsAt"
                name="endsAt"
                type="date"
                required
                min={startsAt || undefined}
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              name="hidden"
              defaultChecked={item?.hidden ?? false}
              className="size-4 accent-[hsl(244,51%,24%)]"
            />
            Piilota etusivulta — näkyy vain suoralla linkillä
          </label>
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              name="leaderDiscount"
              defaultChecked={item?.leaderDiscount ?? false}
              className="mt-0.5 size-4 accent-[hsl(244,51%,24%)]"
            />
            <span>
              Tässä tapahtumassa on käytössä johtajien alennus
              <span className="block text-xs text-muted-foreground">
                Johtajien alennuskoodi (esim. JOHTAJA) toimii vain näin merkityissä tapahtumissa.
                Koodit hallitaan kohdassa Alennuskoodit.
              </span>
            </span>
          </label>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {!isEvent && (
          <div className="space-y-1.5">
            <Label htmlFor="categoryId">Kategoria *</Label>
            <Select
              id="categoryId"
              name="categoryId"
              defaultValue={item?.categoryId ?? categories[0]?.id}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="accountingClassId">Kirjanpitoluokka</Label>
          <Select
            id="accountingClassId"
            name="accountingClassId"
            defaultValue={item?.accountingClassId ?? ''}
          >
            <option value="">Ei luokkaa</option>
            {accountingClasses.map((accountingClass) => (
              <option key={accountingClass.id} value={accountingClass.id}>
                {accountingClass.name}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">Vain sisäiseen kirjanpitoon.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="price">Hinta (€) *</Label>
          <Input
            id="price"
            name="price"
            required
            inputMode="decimal"
            pattern="[0-9]+([.,][0-9]{1,2})?"
            title="Hinta euroina, esim. 16 tai 16,00"
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
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            defaultValue={item?.stock?.toString() ?? ''}
            placeholder="Tyhjä = rajoittamaton"
            aria-describedby="stock-help"
          />
          <p id="stock-help" className="text-xs text-muted-foreground">
            Jätä tyhjäksi, jos määrä on rajaton.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sortOrder">Järjestysnumero</Label>
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            step="1"
            inputMode="numeric"
            defaultValue={item?.sortOrder ?? 0}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="imageUrl">Kuva</Label>
        <input type="hidden" name="imageUrl" value={imageUrl} />
        <div className="flex gap-4">
          <div className="w-24 shrink-0">
            <ItemImage src={imageUrl || null} alt="Tuotekuvan esikatselu" />
          </div>
          <div className="flex-1 space-y-2">
            {/* Migrated products can use same-origin paths such as /products/foo.jpeg. */}
            <Input
              id="imageUrl"
              type="text"
              inputMode="url"
              spellCheck={false}
              autoCapitalize="none"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://… tai /products/…"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
              className="hidden"
              onChange={onPickImage}
            />
            <div className="flex items-center gap-2">
              <KuvatPicker onSelect={setImageUrl} />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <LoadingPill className="bg-current/25" />
                ) : (
                  <>
                    <Upload /> Lataa kuva
                  </>
                )}
              </Button>
              {imageUrl && !uploading && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setImageUrl('')}>
                  Poista kuva
                </Button>
              )}
            </div>
            {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Kuvaus</Label>
        <Textarea
          id="description"
          name="description"
          rows={6}
          defaultValue={item?.description ?? ''}
          placeholder={
            isEvent
              ? 'Kerro tapahtuman sisällöstä, paikasta ja tärkeistä ohjeista.'
              : 'Kerro tuotteesta, koosta, materiaalista tai muista tärkeistä tiedoista.'
          }
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={item?.active ?? true}
          className="size-4 accent-[hsl(244,51%,24%)]"
        />
        Julkaistu
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="featured"
          defaultChecked={item?.featured ?? false}
          className="size-4 accent-[hsl(244,51%,24%)]"
        />
        Nosta etusivulle{' '}
        <span className="text-xs text-muted-foreground">(näkyy Nostot-osiossa)</span>
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
                aria-label={`Kysymyksen ${index + 1} teksti`}
                value={q.prompt}
                onChange={(e) => updateQuestion(q.key, { prompt: e.target.value })}
                placeholder="Kysymysteksti, esim. Hupparin koko"
                className="flex-1"
              />
              <Select
                aria-label={`Kysymyksen ${index + 1} tyyppi`}
                value={q.type}
                onChange={(e) => updateQuestion(q.key, { type: e.target.value as QuestionType })}
                className="w-40"
              >
                {QUESTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type === 'TEXT'
                      ? 'Teksti'
                      : type === 'NUMBER'
                        ? 'Numero'
                        : type === 'RADIO'
                          ? 'Valinta (yksi)'
                          : 'Valinta (useita)'}
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
                <span className="text-xs text-muted-foreground">
                  Valintakysymys on aina pakollinen.
                </span>
              )}
            </div>
            {(q.type === 'RADIO' || q.type === 'CHECKBOX') && (
              <Textarea
                aria-label={`Kysymyksen ${index + 1} vaihtoehdot`}
                rows={3}
                value={q.optionsText}
                onChange={(e) => updateQuestion(q.key, { optionsText: e.target.value })}
                placeholder={'Yksi vaihtoehto per rivi, esim.\nS\nM\nL'}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center">
        <Link
          href={returnHref}
          className="inline-flex h-10 items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          Peruuta
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <LoadingPill className="bg-current/25" />
          ) : item ? (
            'Tallenna tuote'
          ) : (
            'Luo tuote'
          )}
        </Button>
      </div>
    </form>
  );
}
