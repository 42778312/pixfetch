import { isValidQuality, isValidVideoId, sanitizeFilename } from '@/lib/constants';
import { mapYoutubeError } from '@/lib/errors';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { downloadVideo } from '@/lib/server/downloader';
import { createSseStream } from '@/lib/server/sse';
import { cancelDownload } from '@/lib/server/ytdlp';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request) {
  const limited = checkRateLimit('download', request);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const quality = searchParams.get('quality') || '720p';
  const taskId =
    searchParams.get('taskId') || `${id}-${quality}-${Date.now()}`;

  if (!isValidVideoId(id)) {
    return Response.json({ error: 'Invalid video ID' }, { status: 400 });
  }
  if (!isValidQuality(quality)) {
    return Response.json({ error: 'Invalid quality parameter' }, { status: 400 });
  }

  return createSseStream(
    async (push) => {
      try {
        await downloadVideo(id, quality, push, taskId);
      } catch (err) {
        await push({
          status: 'error',
          progress: 0,
          speed: '0 MB/s',
          eta: mapYoutubeError(err),
          videoId: id,
        });
      }
    },
    { onCancel: () => cancelDownload(taskId) }
  );
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');
  if (!taskId) {
    return Response.json({ error: 'taskId is required' }, { status: 400 });
  }
  const cancelled = cancelDownload(taskId);
  return Response.json({ cancelled });
}
