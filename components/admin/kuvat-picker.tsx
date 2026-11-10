'use client';

import { useState } from 'react';
import { Images, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

type Folder = { host: string; path: string; name: string; count: number };
type Image = { id: number; title: string; url: string; thumbnailUrl: string; width: number; height: number };

export function KuvatPicker({ onSelect }: { onSelect: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [images, setImages] = useState<Image[]>([]);
  const [folderKey, setFolderKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadFolders() {
    setOpen(true);
    setError(null);
    if (folders.length) return;
    setLoading(true);
    try {
      const response = await fetch('/api/items/kuvat');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Kuvakansioita ei voitu ladata.');
      setFolders(data.folders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kuvat.fi-yhteys epäonnistui.');
    } finally {
      setLoading(false);
    }
  }

  async function chooseFolder(value: string) {
    setFolderKey(value);
    setImages([]);
    if (!value) return;
    const [host, ...pathParts] = value.split('|');
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/items/kuvat?action=images&host=${encodeURIComponent(host)}&folder=${encodeURIComponent(pathParts.join('|'))}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Kuvia ei voitu ladata.');
      setImages(data.images);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kuvien lataus epäonnistui.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => void loadFolders()}>
        <Images /> Valitse Kuvat.fi:stä
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Valitse kuva Kuvat.fi:stä">
          <div className="max-h-[min(760px,90vh)] w-full max-w-4xl overflow-hidden rounded-lg border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold">Valitse kuva Kuvat.fi:stä</h2>
              <Button type="button" size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="Sulje"><X /></Button>
            </div>
            <div className="space-y-4 overflow-y-auto p-4">
              <Select value={folderKey} onChange={(event) => void chooseFolder(event.target.value)} disabled={loading || !folders.length} aria-label="Kuvakansio">
                <option value="">Valitse kuvakansio ({folders.length})</option>
                {folders.map((folder) => <option key={`${folder.host}|${folder.path}`} value={`${folder.host}|${folder.path}`}>{folder.name} ({folder.count})</option>)}
              </Select>
              {loading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Ladataan…</p>}
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              {images.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {images.map((image) => (
                    <button key={image.id} type="button" className="group overflow-hidden rounded-md border text-left hover:border-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { onSelect(image.url); setOpen(false); }}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- Kuvat.fi thumbnail URLs are dynamic */}
                      <img src={image.thumbnailUrl} alt={image.title} className="aspect-square w-full object-cover transition group-hover:opacity-80" />
                      <span className="block truncate px-2 py-1.5 text-xs">{image.title}</span>
                    </button>
                  ))}
                </div>
              )}
              {!loading && folderKey && !images.length && !error && <p className="text-sm text-muted-foreground">Kansiossa ei ole valittavia kuvia.</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
