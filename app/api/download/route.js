import { downloadVideo } from '@/lib/downloader';
import { cancelDownload } from '@/lib/downloadRegistry';
import { isValidVideoId, isValidQuality } from '@/lib/constants';
import { mapYoutubeError } from '@/lib/errors';
import { checkRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

async function runDownload(videoId, quality, onProgress, downloadId) {
  try {
    return await downloadVideo(videoId, quality, onProgress, downloadId);
  } catch (ytdlError) {
    const { downloadWithYtDlp, isYtDlpAvailable } = require('@/lib/ytdlp');
    if (await isYtDlpAvailable()) {
      return await downloadWithYtDlp(videoId, quality, onProgress);
    }
    throw ytdlError;
  }
}

export async function GET(request) {
  const limited = checkRateLimit('download', request);
  if (limited) return limited;

  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('id');
    const quality = searchParams.get('quality') || '720p';
    const taskId = searchParams.get('taskId');

    if (!videoId) {
      return Response.json({ error: 'Video ID is required' }, { status: 400 });
    }

    if (!isValidVideoId(videoId)) {
      return Response.json({ error: 'Invalid video ID' }, { status: 400 });
    }

    if (!isValidQuality(quality)) {
      return Response.json({ error: 'Invalid quality parameter' }, { status: 400 });
    }

    const downloadId = taskId || `${videoId}-${quality}-${Date.now()}`;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {
            // stream may be closed
          }
        };

        const onAbort = () => {
          cancelDownload(downloadId);
        };

        request.signal.addEventListener('abort', onAbort);

        try {
          await runDownload(
            videoId,
            quality,
            (progressData) => {
              sendEvent(progressData);
            },
            downloadId
          );
          controller.close();
        } catch (err) {
          if (!request.signal.aborted) {
            console.error('Download stream error:', err);
            sendEvent({
              status: 'error',
              progress: 0,
              speed: '0 MB/s',
              eta: mapYoutubeError(err),
              videoId,
            });
          }
          controller.close();
        } finally {
          request.signal.removeEventListener('abort', onAbort);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return Response.json({ error: 'Server SSE error: ' + error.message }, { status: 500 });
  }
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
