import { getDownloadStatus } from '@/lib/downloadPaths';
import { isValidVideoId, isValidQuality } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('id');
    const quality = searchParams.get('quality') || '720p';
    const size = searchParams.get('size');

    if (!videoId) {
      return Response.json({ error: 'Video ID is required' }, { status: 400 });
    }

    if (!isValidVideoId(videoId)) {
      return Response.json({ error: 'Invalid video ID' }, { status: 400 });
    }

    if (!isValidQuality(quality)) {
      return Response.json({ error: 'Invalid quality parameter' }, { status: 400 });
    }

    return Response.json(getDownloadStatus(videoId, quality, size));
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
