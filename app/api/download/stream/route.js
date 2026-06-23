import { checkRateLimit } from '@/lib/rateLimit';
import { streamVideoToResponse } from '@/lib/downloader';
import { isValidVideoId, isValidQuality, sanitizeFilename } from '@/lib/constants';
import { mapYoutubeError } from '@/lib/errors';
import { Readable } from 'stream';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export const dynamic = 'force-dynamic';

async function resolveStream(videoId, quality, clipOptions) {
  const { ensureYtDlpBinary, streamVideoWithYtDlp } = require('@/lib/ytdlp');

  try {
    await ensureYtDlpBinary();
    return streamVideoWithYtDlp(videoId, quality, clipOptions);
  } catch {
    return streamVideoToResponse(videoId, quality, clipOptions);
  }
}

export async function GET(request) {
  const limited = checkRateLimit('download', request);
  if (limited) return limited;

  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('id');
    const quality = searchParams.get('quality') || '720p';
    const title = searchParams.get('title') || 'video';
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (!videoId) {
      return Response.json({ error: 'Video ID is required' }, { status: 400 });
    }

    if (!isValidVideoId(videoId)) {
      return Response.json({ error: 'Invalid video ID' }, { status: 400 });
    }

    if (!isValidQuality(quality)) {
      return Response.json({ error: 'Invalid quality parameter' }, { status: 400 });
    }

    const startSeconds = start ? parseFloat(start) : 0;
    const endSeconds = end ? parseFloat(end) : null;

    if (Number.isNaN(startSeconds) || startSeconds < 0) {
      return Response.json({ error: 'Invalid start time' }, { status: 400 });
    }

    if (endSeconds !== null && (Number.isNaN(endSeconds) || endSeconds <= startSeconds)) {
      return Response.json({ error: 'Invalid end time' }, { status: 400 });
    }

    const { stream, contentType, ext } = await resolveStream(videoId, quality, {
      startSeconds,
      endSeconds,
    });

    const cleanTitle = sanitizeFilename(title);
    const hasClip = startSeconds > 0 || endSeconds !== null;
    const clientFilename = hasClip ? `${cleanTitle}_clip.${ext}` : `${cleanTitle}.${ext}`;

    const webStream = Readable.toWeb(stream);

    return new Response(webStream, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(clientFilename)}"; filename*=UTF-8''${encodeURIComponent(clientFilename)}`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    return Response.json({ error: mapYoutubeError(error) }, { status: 500 });
  }
}
