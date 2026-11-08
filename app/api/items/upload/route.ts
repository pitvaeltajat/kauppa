import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { adminRole } from '@/lib/admin-guard';
import { isEventAdmin } from '@/lib/admin';

/**
 * Client-upload token endpoint for product/event images (Vercel Blob).
 *
 * The admin form uploads the file straight to Blob with `upload()` from
 * `@vercel/blob/client`; that call first POSTs here to mint a short-lived,
 * scoped token. Going direct to Blob sidesteps the 4.5 MB function body limit,
 * so a phone photo uploads fine. We only gate who may get a token — event
 * admins and superadmins, the same people who may edit items.
 *
 * Needs `BLOB_READ_WRITE_TOKEN` in the environment (set when the Blob store is
 * linked to the project); `handleUpload` reads it automatically.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        if (!isEventAdmin(await adminRole())) throw new Error('Ei oikeuksia ladata kuvia.');
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'],
          maximumSizeInBytes: 8 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      // Fires from Blob after the upload; nothing to persist here — the form
      // posts the returned URL as part of the item itself. (Skipped on
      // localhost, where Blob can't reach a callback URL.)
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
