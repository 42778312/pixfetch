import { mapYoutubeError } from '@/lib/errors';
import { buildPlaylistUrl, buildVideoUrl, parseYoutubeInput } from '@/lib/urlParser';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { fetchPlaylistInfo, fetchVideoInfo } from '@/lib/server/youtubeInfo';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const limited = checkRateLimit('info', request);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const mode = searchParams.get('mode');

  if (!url) {
    return Response.json({ error: 'URL is required' }, { status: 400 });
  }

  const parsed = parseYoutubeInput(url);
  if (!parsed.mode) {
    return Response.json(
      { error: 'Invalid YouTube URL. Please enter a valid video or playlist link.' },
      { status: 400 }
    );
  }

  let effectiveMode = parsed.mode;
  if (mode === 'video' || mode === 'playlist') {
    effectiveMode = mode;
  }

  if (effectiveMode === 'ambiguous') {
    return Response.json({
      type: 'ambiguous',
      videoId: parsed.videoId,
      playlistId: parsed.playlistId,
      videoUrl: buildVideoUrl(parsed.videoId),
      playlistUrl: buildPlaylistUrl(parsed.playlistId),
    });
  }

  try {
    if (effectiveMode === 'playlist' && parsed.playlistId) {
      return Response.json(await fetchPlaylistInfo(parsed.playlistId));
    }
    if (parsed.videoId) {
      return Response.json(await fetchVideoInfo(buildVideoUrl(parsed.videoId)));
    }
    return Response.json({ error: 'Invalid YouTube URL.' }, { status: 400 });
  } catch (err) {
    return Response.json({ error: mapYoutubeError(err) }, { status: 500 });
  }
}
