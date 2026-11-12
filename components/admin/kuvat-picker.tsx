'use client';

import { useEffect, useState } from 'react';
import { Images, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

type Folder = { host: string; path: string; name: string; count: number };
type Image = {
  id: number;
  title: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
};

function normalizeFolderPath(path: string) {
  const trimmed = path.trim();
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}/`;
}

export function KuvatPicker({
  onSelect,
  folderPath,
  buttonLabel = 'Valitse Kuvat.fi:stä',
}: {
  onSelect: (url: string) => void;
  folderPath?: string;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [images, setImages] = useState<Image[]>([]);
  const [folderKey, setFolderKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [open]);

  async function loadFolderImages(value: string) {
    setFolderKey(value);
    setImages([]);
    if (!value) return;
    const [host, ...pathParts] = value.split('|');
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/items/kuvat?action=images&host=${encodeURIComponent(host)}&folder=${encodeURIComponent(pathParts.join('|'))}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Kuvia ei voitu ladata.');
      setImages(data.images);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kuvien lataus epäonnistui.');
    } finally {
      setLoading(false);
    }
  }

  async function loadFolders() {
    setOpen(true);
    setError(null);
    if (folders.length) return;
    setLoading(true);
    try {
      const response = await fetch('/api/items/kuvat');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Kuvakansioita ei voitu ladata.');
      const nextFolders = folderPath
        ? data.folders.filter(
            (folder: Folder) =>
              normalizeFolderPath(folder.path) === normalizeFolderPath(folderPath),
          )
        : data.folders;
      setFolders(nextFolders);
      const firstFolder = nextFolders[0];
      if (firstFolder) void loadFolderImages(`${firstFolder.host}|${firstFolder.path}`);
      else if (folderPath) setError(`Kuvakansiota ${folderPath} ei löytynyt.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kuvat.fi-yhteys epäonnistui.');
    } finally {
      setLoading(false);
    }
  }

  async function chooseFolder(value: string) {
    await loadFolderImages(value);
  }

  async function chooseImage(image: Image) {
    setImporting(true);
    setError(null);
    try {
      const response = await fetch('/api/items/kuvat/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: image.url }),
      });
      const data = (await response.json()) as { publicUrl?: string; error?: string };
      if (!response.ok || !data.publicUrl)
        throw new Error(data.error || 'Kuvan tuonti epäonnistui.');
      onSelect(data.publicUrl);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kuvan tuonti epäonnistui.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => void loadFolders()}>
        <Images /> {buttonLabel}
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Valitse kuva Kuvat.fi:stä"
        >
          <div className="flex max-h-[min(760px,90vh)] w-full max-w-4xl flex-col overflow-hidden rounded-lg border bg-background shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold">Valitse kuva Kuvat.fi:stä</h2>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setOpen(false)}
                aria-label="Sulje"
              >
                <X />
              </Button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 [touch-action:pan-y]">
              {!folderPath && (
                <Select
                  value={folderKey}
                  onChange={(event) => void chooseFolder(event.target.value)}
                  disabled={loading || importing || !folders.length}
                  aria-label="Kuvakansio"
                >
                  <option value="">Valitse kuvakansio ({folders.length})</option>
                  {folders.map((folder) => (
                    <option
                      key={`${folder.host}|${folder.path}`}
                      value={`${folder.host}|${folder.path}`}
                    >
                      {folder.name} ({folder.count})
                    </option>
                  ))}
                </Select>
              )}
              {(loading || importing) && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {importing ? 'Pakataan ja tallennetaan omaan kuvapalveluun…' : 'Ladataan…'}
                </p>
              )}
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              {images.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {images.map((image) => (
                    <button
                      key={image.id}
                      type="button"
                      className="group overflow-hidden rounded-md border text-left hover:border-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => void chooseImage(image)}
                      disabled={importing}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- Kuvat.fi thumbnail URLs are dynamic */}
                      <img
                        src={image.thumbnailUrl}
                        alt={image.title}
                        className="aspect-square w-full object-cover transition group-hover:opacity-80"
                      />
                      <span className="block truncate px-2 py-1.5 text-xs">{image.title}</span>
                    </button>
                  ))}
                </div>
              )}
              {!loading && folderKey && !images.length && !error && (
                <p className="text-sm text-muted-foreground">Kansiossa ei ole valittavia kuvia.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
