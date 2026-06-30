import { isValidQuality, isValidVideoId, sanitizeFilename } from '@/lib/constants';
import { mapYoutubeError } from '@/lib/errors';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { streamVideo } from '@/lib/server/streamResolver';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request) {
  const limited = checkRateLimit('download', request);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const quality = searchParams.get('quality') || '720p';
  const title = searchParams.get('title') || 'video';
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!isValidVideoId(id)) {
    return Response.json({ error: 'Invalid video ID' }, { status: 400 });
  }
  if (!isValidQuality(quality)) {
    return Response.json({ error: 'Invalid quality parameter' }, { status: 400 });
  }

  const startSeconds = start ? parseFloat(start) : 0;
  const endSeconds = end ? parseFloat(end) : null;

  if (start && (Number.isNaN(startSeconds) || startSeconds < 0)) {
    return Response.json({ error: 'Invalid start time' }, { status: 400 });
  }
  if (
    endSeconds !== null &&
    (Number.isNaN(endSeconds) || endSeconds <= startSeconds)
  ) {
    return Response.json({ error: 'Invalid end time' }, { status: 400 });
  }

  try {
    const { byteIter, contentType, ext } = await streamVideo(id, quality, {
      startSeconds,
      endSeconds,
    });

    const cleanTitle = sanitizeFilename(title);
    const hasClip = startSeconds > 0 || endSeconds !== null;
    const clientFilename = hasClip ? `${cleanTitle}_clip.${ext}` : `${cleanTitle}.${ext}`;
    const encoded = encodeURIComponent(clientFilename);

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of byteIter) {
            controller.enqueue(chunk);
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    return Response.json({ error: mapYoutubeError(err) }, { status: 500 });
  }
}
