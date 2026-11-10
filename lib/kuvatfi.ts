const KUVATFI_APPLICATION = 'wppicker';
const KUVATFI_VERSION = '1.0.9';
const KUVATFI_DEFAULT_HOST = 'kuvat.pitva.fi';

type KuvatApiValue = Record<string, unknown> | unknown[];
type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function apiUrl(host: string, params: Record<string, string>) {
  const url = new URL('/', `https://${host}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

function isAllowedGalleryHost(host: string) {
  return (
    host === (process.env.KUVATFI_HOST?.trim() || KUVATFI_DEFAULT_HOST) ||
    host.endsWith('.kuvat.fi')
  );
}

async function callKuvatApi(host: string, params: Record<string, string>) {
  const response = await fetch(
    apiUrl(host, {
      application: KUVATFI_APPLICATION,
      version: KUVATFI_VERSION,
      sourcedomain: process.env.NEXTAUTH_URL
        ? new URL(process.env.NEXTAUTH_URL).hostname
        : 'kontti.pitva.fi',
      ...params,
    }),
    { cache: 'no-store' },
  );
  if (!response.ok) throw new Error(`Kuvat.fi palautti virheen (${response.status}).`);
  const data = (await response.json()) as KuvatApiValue;
  if (data && !Array.isArray(data) && 'error' in data && data.error) {
    throw new Error('Kuvat.fi ei hyväksynyt pyyntöä. Tarkista API-avain.');
  }
  return data;
}

async function createSession() {
  const token = process.env.KUVATFI_API_KEY?.trim();
  if (!token) throw new Error('Kuvat.fi-kuvavalitsinta ei ole määritetty.');

  const created = await callKuvatApi('session.kuvat.fi', {
    action: 'getSessionId',
    usersession: '',
  });
  const sid =
    created && !Array.isArray(created) && typeof created.sid === 'string' ? created.sid : '';
  if (sid.length < 60) throw new Error('Kuvat.fi-istuntoa ei voitu luoda.');

  const login = await callKuvatApi('session.kuvat.fi', {
    action: 'loginSessionWithToken',
    usersession: '',
    sid,
    token,
  });
  if (!login || Array.isArray(login) || !login.status) {
    throw new Error('Kuvat.fi API-avain ei kelpaa tai sen käyttöoikeus puuttuu.');
  }
  return sid;
}

export type KuvatFolder = { host: string; path: string; name: string; count: number };

function folderName(path: string) {
  const parts = path.split('/').filter(Boolean);
  return parts.at(-1) || path;
}

export async function getKuvatFolders(): Promise<KuvatFolder[]> {
  const sid = await createSession();
  const galleries = await callKuvatApi('kuvat.fi', { type: 'galleryList', usersession: sid });
  if (!Array.isArray(galleries)) return [];

  const result: KuvatFolder[] = [];
  for (const rawGallery of galleries) {
    if (!isRecord(rawGallery) || rawGallery.type !== 'admin') continue;
    const gallery = rawGallery;
    const host =
      typeof gallery.url === 'string'
        ? gallery.url.replace(/^https?:\/\//, '').replace(/\/$/, '')
        : '';
    if (!host || !isAllowedGalleryHost(host)) continue;
    const tree = await callKuvatApi('kuvat.fi', {
      type: 'getFolderTree',
      usersession: sid,
      host,
    });
    if (!tree || Array.isArray(tree) || typeof tree !== 'object') continue;
    for (const [path, value] of Object.entries(tree)) {
      if (!isRecord(value)) continue;
      const count = Number(value.fc ?? 0);
      if (count > 0 && !value.h && !value.hh && !value.salasana) {
        result.push({ host, path, name: `${host} — ${folderName(path)}`, count });
      }
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, 'fi'));
}

export type KuvatImage = {
  id: number;
  title: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
};

function sourceDomain() {
  return process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).hostname : 'kontti.pitva.fi';
}

export async function getKuvatImages(host: string, folder: string): Promise<KuvatImage[]> {
  if (!isAllowedGalleryHost(host) || !folder.startsWith('/'))
    throw new Error('Virheellinen Kuvat.fi-kansio.');
  const sid = await createSession();
  const data = await callKuvatApi('kuvat.fi', {
    type: 'getFileListJSON',
    usersession: sid,
    host,
    folder,
  });
  if (!Array.isArray(data)) return [];

  return data.flatMap((image) => {
    if (!isRecord(image) || image.type !== 'image') return [];
    const filepath = typeof image.filepath === 'string' ? image.filepath : '';
    const id = Number(image.id);
    if (!filepath || !Number.isInteger(id) || id <= 0) return [];
    const extension = filepath.split('.').at(-1)?.toLowerCase();
    if (!extension || !['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) return [];
    const width = Number(image.i_x) || 100;
    const height = Number(image.i_y) || 100;
    const title = filepath.split('/').at(-1) || `Kuva ${id}`;
    const encodedPath = filepath
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');
    const imagePathUrl = `https://${host}${encodedPath}`;
    const imageUrl = `${imagePathUrl}?img=full`;
    const imageInfo = isRecord(image.url) ? image.url : null;
    const sizes = imageInfo && Array.isArray(imageInfo.sizes) ? imageInfo.sizes : [];
    const thumbnailHost =
      imageInfo && typeof imageInfo.ts === 'string'
        ? imageInfo.ts.replace(/^https?:\/\//, '').replace(/\/$/, '')
        : '';
    const thumb =
      imageInfo && typeof imageInfo.hash === 'string' && thumbnailHost && sizes.includes('sqr480')
        ? `https://${thumbnailHost}/tt/?key=${encodeURIComponent(imageInfo.hash)}&size=sqr480`
        : `${imagePathUrl}?application=${KUVATFI_APPLICATION}&version=${KUVATFI_VERSION}&sourcedomain=${encodeURIComponent(sourceDomain())}&usersession=${encodeURIComponent(sid)}&img=sqr480`;
    return [{ id, title, url: imageUrl, thumbnailUrl: thumb, width, height }];
  });
}
