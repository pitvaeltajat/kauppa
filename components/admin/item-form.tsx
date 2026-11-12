'use client';

import { useRef, useState } from 'react';
import { useActionState } from 'react';
import Link from 'next/link';
import { Plus, Trash2, Upload, X } from 'lucide-react';
import type { Category } from '@prisma/client';
import { saveItem } from '@/lib/actions/admin';
import {
  DIETARY_REQUIREMENTS_QUESTION,
  PARTICIPANT_NAME_QUESTION,
  QUESTION_TYPES,
  type QuestionType,
} from '@/lib/questions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingPill } from '@/components/ui/loading-pill';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { ItemImage } from '@/components/item-image';
import { KuvatPicker } from '@/components/admin/kuvat-picker';
import { DEFAULT_EVENT_ACCOUNTING_CLASS_NAME } from '@/lib/accounting';
import { slugify } from '@/lib/slug';
import { EventDateFields } from '@/components/admin/event-date-fields';

export type ItemFormValues = {
  id?: string;
  name: string;
  slug: string;
  categoryId: string;
  accountingClassId: string | null;
  stock: number | null;
  imageUrl: string | null;
  description: string;
  sortOrder: number;
  active: boolean;
  featured: boolean;
  notificationEmails: string[];
  createdByEmail: string | null;
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
  variants: { id: string; name: string | null; priceCents: number }[];
};

type QuestionDraft = {
  key: string;
  prompt: string;
  type: QuestionType;
  required: boolean;
  optionsText: string;
};

type VariantDraft = { key: string; name: string; price: string };

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

function draftFromVariant(variant: ItemFormValues['variants'][number]): VariantDraft {
  return {
    key: variant.id,
    name: variant.name ?? '',
    price: (variant.priceCents / 100).toFixed(2).replace('.', ','),
  };
}

export function ItemForm({
  categories,
  accountingClasses,
  notificationUsers = [],
  creatorEmail,
  item,
  eventMode = false,
  returnHref = eventMode ? '/admin/events' : '/admin/items',
}: {
  categories: Category[];
  accountingClasses: { id: string; name: string }[];
  notificationUsers?: { email: string; name: string | null }[];
  creatorEmail?: string | null;
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
  const [variants, setVariants] = useState<VariantDraft[]>(
    item?.variants?.length
      ? item.variants.map(draftFromVariant)
      : [{ key: 'new-price', name: '', price: '' }],
  );
  const [selectedNotificationEmails, setSelectedNotificationEmails] = useState<string[]>([
    ...new Set([
      ...(item?.notificationEmails ?? []),
      ...(item?.createdByEmail ? [item.createdByEmail] : creatorEmail ? [creatorEmail] : []),
    ]),
  ]);
  const [notificationSearch, setNotificationSearch] = useState('');
  const [name, setName] = useState(item?.name ?? '');
  const [slug, setSlug] = useState(item?.slug ?? '');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(Boolean(item?.id));
  const isEvent = eventMode;
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? '');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filteredNotificationUsers = notificationUsers.filter((user) => {
    const needle = notificationSearch.trim().toLowerCase();
    return !needle || `${user.name ?? ''} ${user.email}`.toLowerCase().includes(needle);
  });

  function addNotificationUser(email: string) {
    setSelectedNotificationEmails((current) =>
      current.includes(email) ? current : [...current, email],
    );
    setNotificationSearch('');
  }

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
      <input
        type="hidden"
        name="variants"
        value={JSON.stringify(
          variants.map(({ name: variantName, price }) => ({ name: variantName, price })),
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nimi *</Label>
          <Input
            id="name"
            name="name"
            required
            value={name}
            onChange={(e) => {
              const next = e.target.value;
              setName(next);
              if (!slugManuallyEdited) setSlug(slugify(next));
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="slug">Tunnus URL-osoitteessa</Label>
          <Input
            id="slug"
            name="slug"
            value={slug}
            onChange={(e) => {
              setSlugManuallyEdited(true);
              setSlug(e.target.value);
            }}
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
          <EventDateFields startsAt={item?.startsAt ?? null} endsAt={item?.endsAt ?? null} />
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              name="hidden"
              defaultChecked={item?.hidden ?? false}
              className="size-4 accent-[hsl(244,51%,24%)]"
            />
            Piilota etusivulta - näkyy vain suoralla linkillä
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
            defaultValue={
              item?.accountingClassId ??
              (eventMode
                ? (accountingClasses.find(
                    ({ name }) => name === DEFAULT_EVENT_ACCOUNTING_CLASS_NAME,
                  )?.id ?? '')
                : '')
            }
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
      </div>

      {!isEvent && (
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
      )}

      {isEvent && (
        <div className="space-y-1.5">
          <Label htmlFor="notificationEmails">Ilmoitusosoitteet</Label>
          <div className="flex min-h-10 flex-wrap gap-2 rounded-md border border-input bg-card p-2">
            {selectedNotificationEmails.map((email) => {
              const user = notificationUsers.find((candidate) => candidate.email === email);
              const isCreator = email === (item?.createdByEmail ?? creatorEmail);
              return (
                <span
                  key={email}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm text-foreground"
                >
                  {user?.name ?? email}
                  {!isCreator && (
                    <button
                      type="button"
                      className="rounded-full p-0.5 text-muted-foreground hover:bg-primary/15 hover:text-foreground"
                      onClick={() =>
                        setSelectedNotificationEmails((current) =>
                          current.filter((selected) => selected !== email),
                        )
                      }
                      aria-label={`Poista ${user?.name ?? email}`}
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </span>
              );
            })}
            {selectedNotificationEmails.length === 0 && (
              <span className="px-1 py-1 text-sm text-muted-foreground">
                Ei valittuja vastaanottajia
              </span>
            )}
          </div>
          {selectedNotificationEmails.map((email) => (
            <input key={email} type="hidden" name="notificationEmails" value={email} />
          ))}
          <input
            className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
            type="search"
            value={notificationSearch}
            onChange={(event) => setNotificationSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              const firstMatch = filteredNotificationUsers.find(
                (user) => !selectedNotificationEmails.includes(user.email),
              );
              if (firstMatch) addNotificationUser(firstMatch.email);
            }}
            placeholder="Hae käyttäjää nimellä tai sähköpostilla"
            aria-label="Hae ilmoitusvastaanottajaa"
          />
          <div className="text-sm text-muted-foreground">
            {notificationSearch && filteredNotificationUsers.length > 0
              ? `Paina Enter lisätäksesi: ${filteredNotificationUsers[0]?.name ?? filteredNotificationUsers[0]?.email}`
              : notificationUsers.length === 0
                ? 'Käyttäjiä ei ole vielä.'
                : 'Hae käyttäjää ja paina Enter lisätäksesi hänet.'}
          </div>
          <p className="text-xs text-muted-foreground">
            Valituille käyttäjille lähetetään viesti uudesta ilmoittautumisesta. Vain ylläpidon
            käyttöön.
          </p>
        </div>
      )}

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

      <div className="space-y-3 rounded-md border bg-background p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-sm font-semibold">Variaatiot ja hinnat</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Lisää esimerkiksi lyhyt ja pitkä leiri omilla hinnoillaan. Kun variaatioita on, ostaja
              valitsee yhden ennen koriin lisäämistä.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() =>
              setVariants((prev) => [...prev, { key: crypto.randomUUID(), name: '', price: '' }])
            }
          >
            <Plus /> Lisää variaatio
          </Button>
        </div>
        {variants.length === 1 ? (
          <div className="space-y-1.5">
            <Label htmlFor={`variant-price-${variants[0].key}`}>Hinta (€) *</Label>
            <Input
              id={`variant-price-${variants[0].key}`}
              value={variants[0].price}
              onChange={(event) =>
                setVariants((prev) =>
                  prev.map((current) =>
                    current.key === variants[0].key
                      ? { ...current, price: event.target.value }
                      : current,
                  ),
                )
              }
              required
              inputMode="decimal"
              pattern="[0-9]+([.,][0-9]{1,2})?"
              title="Hinta euroina, esimerkiksi 16 tai 16,00"
              placeholder="16,00"
            />
            <p className="text-xs text-muted-foreground">
              Yksi hinta näkyy tuotteella suoraan ilman variaatiovalintaa.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {variants.map((variant, index) => (
              <div key={variant.key} className="flex items-end gap-2 rounded-md border bg-card p-3">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor={`variant-name-${variant.key}`}>Nimi {index + 1}</Label>
                  <Input
                    id={`variant-name-${variant.key}`}
                    value={variant.name}
                    onChange={(event) =>
                      setVariants((prev) =>
                        prev.map((current) =>
                          current.key === variant.key
                            ? { ...current, name: event.target.value }
                            : current,
                        ),
                      )
                    }
                    placeholder="Esimerkiksi pitkä leiri"
                    required
                  />
                </div>
                <div className="w-32 space-y-1.5">
                  <Label htmlFor={`variant-price-${variant.key}`}>Hinta</Label>
                  <Input
                    id={`variant-price-${variant.key}`}
                    value={variant.price}
                    onChange={(event) =>
                      setVariants((prev) =>
                        prev.map((current) =>
                          current.key === variant.key
                            ? { ...current, price: event.target.value }
                            : current,
                        ),
                      )
                    }
                    inputMode="decimal"
                    placeholder="40,00"
                  />
                </div>
                <button
                  type="button"
                  aria-label={`Poista variaatio ${index + 1}`}
                  className="mb-2 text-muted-foreground transition-colors hover:text-destructive"
                  onClick={() =>
                    setVariants((prev) => prev.filter((current) => current.key !== variant.key))
                  }
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

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
        {isEvent && (
          <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
            <p className="text-sm font-semibold">Tapahtuman pakolliset kysymykset</p>
            <p className="text-xs text-muted-foreground">
              Nämä kysytään aina ilmoittautumisen yhteydessä. Niitä ei tarvitse lisätä itse.
            </p>
            {[PARTICIPANT_NAME_QUESTION, DIETARY_REQUIREMENTS_QUESTION].map((question, index) => (
              <div key={question.id} className="rounded-md border bg-card p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{index + 1}.</span>
                  <span className="text-sm font-medium">{question.prompt}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {question.required ? 'Vastaus pakollinen' : 'Vastaus valinnainen'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        {questions.length === 0 && (
          <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
            {eventMode
              ? 'Ei lisäkysymyksiä - tapahtuma ostetaan suoraan ilman lisätietoja.'
              : 'Ei kysymyksiä - tuote ostetaan suoraan ilman lisätietoja.'}
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
            eventMode ? (
              'Tallenna tapahtuma'
            ) : (
              'Tallenna tuote'
            )
          ) : eventMode ? (
            'Luo tapahtuma'
          ) : (
            'Luo tuote'
          )}
        </Button>
      </div>
    </form>
  );
}
