import { getVideoInfo } from '@/lib/downloader';
import { parseYoutubeInput, buildVideoUrl } from '@/lib/urlParser';
import { mapYoutubeError } from '@/lib/errors';
import { checkRateLimit } from '@/lib/rateLimit';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { fetchPlaylistInfo } = require('@/lib/playlistFetcher.cjs');
const { isServerlessRuntime } = require('@/lib/storagePaths');

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function fetchVideoInfoSafe(url) {
  const { getVideoInfoWithYtDlp, mapYtDlpToVideoInfo } = require('@/lib/ytdlp');

  async function tryYtDlp() {
    const data = await getVideoInfoWithYtDlp(url);
    return mapYtDlpToVideoInfo(data);
  }

  async function tryYtdl() {
    return await getVideoInfo(url);
  }

  const primary = isServerlessRuntime() ? tryYtDlp : tryYtdl;
  const fallback = isServerlessRuntime() ? tryYtdl : tryYtDlp;

  try {
    return await primary();
  } catch (primaryError) {
    try {
      return await fallback();
    } catch {
      throw primaryError;
    }
  }
}

export async function GET(request) {
  const limited = checkRateLimit('info', request);
  if (limited) return limited;

  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

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

    const explicitMode = searchParams.get('mode');
    let effectiveMode = parsed.mode;
    if (explicitMode === 'video' || explicitMode === 'playlist') {
      effectiveMode = explicitMode;
    }

    if (effectiveMode === 'ambiguous') {
      return Response.json({
        type: 'ambiguous',
        videoId: parsed.videoId,
        playlistId: parsed.playlistId,
        videoUrl: buildVideoUrl(parsed.videoId),
        playlistUrl: `https://www.youtube.com/playlist?list=${parsed.playlistId}`,
      });
    }

    if (effectiveMode === 'playlist' && parsed.playlistId) {
      try {
        const playlistData = await fetchPlaylistInfo(parsed.playlistId);
        return Response.json(playlistData);
      } catch (error) {
        return Response.json({ error: mapYoutubeError(error) }, { status: 500 });
      }
    }

    if (parsed.videoId) {
      try {
        const videoData = await fetchVideoInfoSafe(buildVideoUrl(parsed.videoId));
        return Response.json(videoData);
      } catch (error) {
        return Response.json({ error: mapYoutubeError(error) }, { status: 500 });
      }
    }

    return Response.json({ error: 'Invalid YouTube URL.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: mapYoutubeError(error) }, { status: 500 });
  }
}
