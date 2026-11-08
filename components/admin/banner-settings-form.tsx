'use client';

import { useRef, useState, useActionState } from 'react';
import { Upload } from 'lucide-react';
import { saveSiteSettings } from '@/lib/actions/site';
import { SiteBanner } from '@/components/site-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function BannerSettingsForm({ bannerImageUrl }: { bannerImageUrl: string | null }) {
  const [state, action, pending] = useActionState(saveSiteSettings, undefined);
  const [imageUrl, setImageUrl] = useState(bannerImageUrl ?? '');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
      setUploadError('Kuvan lataus epäonnistui. Tarkista tiedostomuoto (JPG/PNG/WebP) ja koko (enintään 10 MB).');
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={action} className="max-w-2xl space-y-5">
      {state?.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      <input type="hidden" name="bannerImageUrl" value={imageUrl} />

      <div className="space-y-1.5">
        <Label htmlFor="bannerImageUrl">Bannerin taustakuva</Label>
        <Input
          id="bannerImageUrl"
          type="url"
          inputMode="url"
          spellCheck={false}
          autoCapitalize="none"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://… tai lataa kuva alta"
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          className="hidden"
          onChange={onPickImage}
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <Upload /> {uploading ? 'Ladataan…' : 'Lataa kuva'}
          </Button>
          {imageUrl && !uploading && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setImageUrl('')}>
              Poista kuva
            </Button>
          )}
        </div>
        {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
        <p className="text-xs text-muted-foreground">
          Leveä kuva toimii parhaiten (esim. maisema). Kuva häivytetään tekstin taakse. Tyhjänä
          banneri näkyy ilman taustakuvaa.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Esikatselu</Label>
        <div className="overflow-hidden rounded-lg border">
          <SiteBanner imageUrl={imageUrl || null} />
        </div>
      </div>

      <Button type="submit" disabled={pending || uploading}>
        {pending ? 'Tallennetaan…' : 'Tallenna banneri'}
      </Button>
    </form>
  );
}
