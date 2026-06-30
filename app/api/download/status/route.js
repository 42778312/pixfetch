import { isValidQuality, isValidVideoId } from '@/lib/constants';
import { getDownloadStatus } from '@/lib/server/storage';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const quality = searchParams.get('quality') || '720p';
  const size = searchParams.get('size');

  if (!isValidVideoId(id)) {
    return Response.json({ error: 'Invalid video ID' }, { status: 400 });
  }
  if (!isValidQuality(quality)) {
    return Response.json({ error: 'Invalid quality parameter' }, { status: 400 });
  }

  try {
    return Response.json(getDownloadStatus(id, quality, size));
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
