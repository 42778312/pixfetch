import { checkRateLimit } from '@/lib/rateLimit';
import { isValidVideoId, isValidQuality, sanitizeFilename } from '@/lib/constants';
import { mapYoutubeError } from '@/lib/errors';
import { getGoogleAccessToken } from '@/lib/googleAuth';
import { createResumableSession, uploadStreamResumable } from '@/lib/googleDrive';
import { resolveStream } from '@/lib/resolveStream';

export const dynamic = 'force-dynamic';

function parseSizeToBytes(sizeStr) {
  if (!sizeStr || sizeStr === 'Auto' || sizeStr === 'Unknown size') return 0;
  const match = String(sizeStr).match(/^([\d.]+)\s*(B|KB|MB|GB)$/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const multipliers = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };
  return Math.round(value * (multipliers[unit] || 1));
}

export async function GET(request) {
  const limited = checkRateLimit('download', request);
  if (limited) return limited;

  const tokenResult = await getGoogleAccessToken(request);
  if (!tokenResult) {
    return Response.json({ error: 'Sign in with Google to save to Drive' }, { status: 401 });
  }
  if (typeof tokenResult === 'object' && tokenResult.reauthRequired) {
    const encoder = new TextEncoder();
    const body = encoder.encode(
      `data: ${JSON.stringify({ status: 'error', progress: 0, speed: '0 MB/s', eta: 'Google Drive permission missing. Sign out, then sign in with Google again and allow Drive access.', code: 'drive_scope_missing' })}\n\n`
    );
    return new Response(body, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  }
  const accessToken = tokenResult;

  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('id');
    const quality = searchParams.get('quality') || '720p';
    const title = searchParams.get('title') || 'video';
    const size = searchParams.get('size') || '';
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const taskId = searchParams.get('taskId') || `${videoId}-${quality}-${Date.now()}`;

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

    const expectedBytes = parseSizeToBytes(size);
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
          // Stream cleanup handled by Node stream destroy on abort
        };

        request.signal.addEventListener('abort', onAbort);

        try {
          sendEvent({
            status: 'connecting',
            progress: 2,
            speed: '0 MB/s',
            eta: 'Starting stream...',
            taskId,
          });

          const { stream: videoStream, contentType, ext } = await resolveStream(videoId, quality, {
            startSeconds,
            endSeconds,
          });

          const cleanTitle = sanitizeFilename(title);
          const hasClip = startSeconds > 0 || endSeconds !== null;
          const filename = hasClip ? `${cleanTitle}_clip.${ext}` : `${cleanTitle}.${ext}`;

          sendEvent({
            status: 'downloading',
            progress: 5,
            speed: '0 MB/s',
            eta: 'Uploading to Google Drive...',
            taskId,
          });

          const sessionUrl = await createResumableSession(accessToken, filename, contentType);
          let lastUpdate = 0;

          const file = await uploadStreamResumable(sessionUrl, videoStream, {
            onProgress: ({ uploaded, total }) => {
              const now = Date.now();
              if (now - lastUpdate < 300) return;
              lastUpdate = now;

              const totalBytes = total || expectedBytes;
              let progress = 10;
              if (totalBytes > 0) {
                progress = Math.min(Math.round((uploaded / totalBytes) * 90) + 5, 95);
              } else if (uploaded > 0) {
                progress = Math.min(50 + Math.round(uploaded / (50 * 1024 * 1024)), 90);
              }

              sendEvent({
                status: 'downloading',
                progress,
                speed: '—',
                eta: 'Uploading to Google Drive...',
                taskId,
              });
            },
          });

          const webViewLink =
            file?.webViewLink ||
            (file?.id ? `https://drive.google.com/file/d/${file.id}/view` : null);

          sendEvent({
            status: 'completed',
            progress: 100,
            speed: '0 MB/s',
            eta: 'Saved to Google Drive',
            taskId,
            webViewLink,
            driveFileId: file?.id,
          });

          controller.close();
        } catch (err) {
          if (!request.signal.aborted) {
            console.error('Google Drive upload error:', err);
            sendEvent({
              status: 'error',
              progress: 0,
              speed: '0 MB/s',
              eta: mapYoutubeError(err),
              taskId,
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
    return Response.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
