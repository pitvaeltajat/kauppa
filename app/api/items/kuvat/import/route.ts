import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { adminRole } from '@/lib/admin-guard';
import { isEventAdmin } from '@/lib/admin';

export const runtime = 'nodejs';

const MAX_BYTES = 1024 * 1024;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const ALLOWED_KUVAT_HOSTS = ['kuvat.fi', 'kuvat.pitva.fi'];

function isAllowedKuvatUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const configuredHost = process.env.KUVATFI_HOST?.trim().toLowerCase();
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      (host === configuredHost || ALLOWED_KUVAT_HOSTS.includes(host) || host.endsWith('.kuvat.fi'))
    );
  } catch {
    return false;
  }
}

async function compressImage(input: Buffer): Promise<Buffer> {
  let result = Buffer.alloc(0);
  for (const size of [2400, 2000, 1600, 1400, 1200, 1000, 800]) {
    for (const quality of [82, 72, 62, 52, 42]) {
      result = await sharp(input)
        .rotate()
        .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
        .webp({ quality })
        .toBuffer();
      if (result.byteLength <= MAX_BYTES) return result;
    }
  }
  return result;
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isEventAdmin(await adminRole())) {
    return NextResponse.json({ error: 'Ei oikeuksia ladata kuvia.' }, { status: 401 });
  }

  const body = (await request.json()) as { url?: string };
  const sourceUrl = typeof body.url === 'string' ? body.url.trim() : '';
  if (!isAllowedKuvatUrl(sourceUrl)) {
    return NextResponse.json({ error: 'Virheellinen Kuvat.fi-kuvan osoite.' }, { status: 400 });
  }

  const bucket = process.env.KAUPPA_AWS_BUCKET_NAME;
  const publicBase = process.env.NEXT_PUBLIC_KAUPPA_ITEM_PHOTOS_URL;
  if (!bucket || !publicBase) {
    return NextResponse.json({ error: 'Kuvapalvelua ei ole määritetty.' }, { status: 500 });
  }

  try {
    const response = await fetch(sourceUrl, { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`Kuvat.fi-kuvan haku epäonnistui (${response.status}).`);
    const contentType = response.headers.get('content-type')?.split(';', 1)[0] ?? '';
    if (!contentType.startsWith('image/')) throw new Error('Kuvat.fi ei palauttanut kuvatiedostoa.');
    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > MAX_SOURCE_BYTES) throw new Error('Kuvat.fi-kuva on liian suuri.');
    const source = Buffer.from(await response.arrayBuffer());
    if (source.byteLength > MAX_SOURCE_BYTES) throw new Error('Kuvat.fi-kuva on liian suuri.');
    const compressed = await compressImage(source);
    if (compressed.byteLength > MAX_BYTES) throw new Error('Kuvaa ei voitu pakata alle 1 Mt:n.');

    const key = `items/${randomUUID()}.webp`;
    const client = new S3Client({
      region: process.env.KAUPPA_AWS_REGION ?? '',
      credentials: {
        accessKeyId: process.env.KAUPPA_AWS_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.KAUPPA_AWS_SECRET_ACCESS_KEY ?? '',
      },
    });
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: compressed,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return NextResponse.json({ publicUrl: `${publicBase.replace(/\/$/, '')}/${key}` });
  } catch (error) {
    console.error('Kuvat.fi-kuvan tuonti epäonnistui:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Kuvat.fi-kuvan tuonti epäonnistui.' },
      { status: 502 },
    );
  }
}
