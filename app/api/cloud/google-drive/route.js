import { isValidQuality, isValidVideoId, sanitizeFilename } from '@/lib/constants';
import { mapYoutubeError } from '@/lib/errors';
import { getGoogleDriveAccessToken } from '@/lib/server/clerkGoogle';
import { createResumableSession, uploadStreamResumable } from '@/lib/server/googleDrive';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { createSseStream, sseEvent } from '@/lib/server/sse';
import { parseSizeToBytes } from '@/lib/server/storage';
import { streamVideo } from '@/lib/server/streamResolver';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request) {
  const limited = checkRateLimit('download', request);
  if (limited) return limited;

  const tokenResult = await getGoogleDriveAccessToken();
  if (!tokenResult) {
    return Response.json(
      { error: 'Sign in with Google to save to Drive' },
      { status: 401 }
    );
  }
  if (typeof tokenResult === 'object' && tokenResult.reauthRequired) {
    return new Response(
      sseEvent({
        status: 'error',
        progress: 0,
        speed: '0 MB/s',
        eta: 'Google Drive permission missing. Sign out, then sign in with Google again and allow Drive access.',
        code: 'drive_scope_missing',
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      }
    );
  }

  const accessToken = tokenResult;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const quality = searchParams.get('quality') || '720p';
  const title = searchParams.get('title') || 'video';
  const size = searchParams.get('size') || '';
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const taskId = searchParams.get('taskId') || `${id}-${quality}-${Date.now()}`;

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

  const expectedBytes = parseSizeToBytes(size);

  return createSseStream(async (push) => {
    try {
      await push({
        status: 'connecting',
        progress: 2,
        speed: '0 MB/s',
        eta: 'Starting stream...',
        taskId,
      });

      const { byteIter, contentType, ext } = await streamVideo(id, quality, {
        startSeconds,
        endSeconds,
      });

      const cleanTitle = sanitizeFilename(title);
      const hasClip = startSeconds > 0 || endSeconds !== null;
      const filename = hasClip ? `${cleanTitle}_clip.${ext}` : `${cleanTitle}.${ext}`;

      await push({
        status: 'downloading',
        progress: 5,
        speed: '0 MB/s',
        eta: 'Uploading to Google Drive...',
        taskId,
      });

      const sessionUrl = await createResumableSession(accessToken, filename, contentType);
      let lastUpdate = 0;

      const onProgress = (progress) => {
        const now = Date.now();
        if (now - lastUpdate < 300) return;
        lastUpdate = now;
        const uploaded = progress.uploaded || 0;
        const total = progress.total || expectedBytes;
        let progressPct = 10;
        if (total > 0) {
          progressPct = Math.min(Math.round((uploaded / total) * 90) + 5, 95);
        } else if (uploaded > 0) {
          progressPct = Math.min(50 + Math.round(uploaded / (50 * 1024 * 1024)), 90);
        }
        push({
          status: 'downloading',
          progress: progressPct,
          speed: '—',
          eta: 'Uploading to Google Drive...',
          taskId,
        });
      };

      const fileData = await uploadStreamResumable(sessionUrl, byteIter, { onProgress });

      const webViewLink =
        fileData.webViewLink ||
        (fileData.id ? `https://drive.google.com/file/d/${fileData.id}/view` : null);

      await push({
        status: 'completed',
        progress: 100,
        speed: '0 MB/s',
        eta: 'Saved to Google Drive',
        taskId,
        webViewLink,
        driveFileId: fileData.id,
      });
    } catch (err) {
      await push({
        status: 'error',
        progress: 0,
        speed: '0 MB/s',
        eta: mapYoutubeError(err),
        taskId,
      });
    }
  });
}
