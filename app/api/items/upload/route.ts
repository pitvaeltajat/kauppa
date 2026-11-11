import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { adminRole } from '@/lib/admin-guard';
import { isEventAdmin } from '@/lib/admin';

/**
 * Presigned-POST endpoint for product/event images (S3), same shape as klapi's
 * `/api/item/uploadImage`. The admin form asks here for a short-lived presigned
 * POST, then uploads the file straight to the public bucket - going direct to
 * S3 sidesteps the 4.5 MB function body limit, so a phone photo uploads fine.
 * We only gate who may get one (event admins and superadmins) and hand back the
 * final public URL for the form to store in `Item.imageUrl`.
 *
 * Reuses the SES IAM credentials (`KAUPPA_AWS_*`); the key additionally needs
 * `s3:PutObject` on `KAUPPA_AWS_BUCKET_NAME`. `NEXT_PUBLIC_KAUPPA_ITEM_PHOTOS_URL`
 * is the bucket's public base URL.
 */
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

export async function POST(request: Request): Promise<NextResponse> {
  if (!isEventAdmin(await adminRole())) {
    return NextResponse.json({ error: 'Ei oikeuksia ladata kuvia.' }, { status: 401 });
  }

  const { contentType } = (await request.json()) as { contentType?: string };
  const ext = contentType ? EXT_BY_TYPE[contentType] : undefined;
  if (!ext) {
    return NextResponse.json(
      { error: 'Vain kuvatiedostot kelpaavat (JPG, PNG, WebP, AVIF, GIF).' },
      { status: 400 },
    );
  }

  const bucket = process.env.KAUPPA_AWS_BUCKET_NAME;
  const publicBase = process.env.NEXT_PUBLIC_KAUPPA_ITEM_PHOTOS_URL;
  if (!bucket || !publicBase) {
    return NextResponse.json({ error: 'Kuvapalvelua ei ole määritetty.' }, { status: 500 });
  }

  const key = `items/${randomUUID()}.${ext}`;

  try {
    const client = new S3Client({
      region: process.env.KAUPPA_AWS_REGION ?? '',
      credentials: {
        accessKeyId: process.env.KAUPPA_AWS_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.KAUPPA_AWS_SECRET_ACCESS_KEY ?? '',
      },
    });
    const { url, fields } = await createPresignedPost(client, {
      Bucket: bucket,
      Key: key,
      Conditions: [
        ['content-length-range', 0, 10 * 1024 * 1024], // up to 10 MB
        ['eq', '$Content-Type', contentType!],
      ],
      Fields: { 'Content-Type': contentType! },
      Expires: 600,
    });
    return NextResponse.json({ url, fields, publicUrl: `${publicBase.replace(/\/$/, '')}/${key}` });
  } catch (error) {
    console.error('Kuvan presigned uploadin luonti epäonnistui:', error);
    return NextResponse.json({ error: 'Kuvan latausta ei voitu aloittaa.' }, { status: 500 });
  }
}
