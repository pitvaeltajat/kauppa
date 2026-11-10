import { NextResponse } from 'next/server';
import { adminRole } from '@/lib/admin-guard';
import { isEventAdmin } from '@/lib/admin';
import { getKuvatFolders, getKuvatImages } from '@/lib/kuvatfi';

export async function GET(request: Request) {
  if (!isEventAdmin(await adminRole())) {
    return NextResponse.json({ error: 'Ei oikeuksia selata kuvia.' }, { status: 401 });
  }

  const url = new URL(request.url);
  try {
    if (url.searchParams.get('action') === 'images') {
      return NextResponse.json({ images: await getKuvatImages(url.searchParams.get('host') ?? '', url.searchParams.get('folder') ?? '') });
    }
    return NextResponse.json({ folders: await getKuvatFolders() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Kuvat.fi-yhteys epäonnistui.' }, { status: 502 });
  }
}
