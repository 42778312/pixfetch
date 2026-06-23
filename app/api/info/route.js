import { getVideoInfo } from '@/lib/downloader';
import { parseYoutubeInput, buildVideoUrl } from '@/lib/urlParser';
import { mapYoutubeError } from '@/lib/errors';
import { checkRateLimit } from '@/lib/rateLimit';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { fetchPlaylistInfo } = require('@/lib/playlistFetcher.cjs');

export const dynamic = 'force-dynamic';

async function fetchVideoInfoSafe(url) {
  try {
    return await getVideoInfo(url);
  } catch (ytdlError) {
    try {
      const { getVideoInfoWithYtDlp, mapYtDlpToVideoInfo } = require('@/lib/ytdlp');
      const data = await getVideoInfoWithYtDlp(url);
      return mapYtDlpToVideoInfo(data);
    } catch {
      throw ytdlError;
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
      // #region agent log
      fetch('http://127.0.0.1:7715/ingest/24a1135b-fca3-4f00-9f43-cc6c874b060c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'46931b'},body:JSON.stringify({sessionId:'46931b',location:'info/route.js:playlist-branch',message:'playlist branch entered',data:{playlistId:parsed.playlistId,effectiveMode,explicitMode,url:url?.slice(0,120)},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      try {
        const playlistData = await fetchPlaylistInfo(parsed.playlistId);
        // #region agent log
        fetch('http://127.0.0.1:7715/ingest/24a1135b-fca3-4f00-9f43-cc6c874b060c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'46931b'},body:JSON.stringify({sessionId:'46931b',location:'info/route.js:playlist-success',message:'playlist fetch succeeded',data:{playlistId:parsed.playlistId,videosCount:playlistData?.videosCount},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
        // #endregion
        return Response.json(playlistData);
      } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7715/ingest/24a1135b-fca3-4f00-9f43-cc6c874b060c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'46931b'},body:JSON.stringify({sessionId:'46931b',location:'info/route.js:playlist-error',message:'playlist fetch failed',data:{playlistId:parsed.playlistId,errorMessage:error?.message?.slice(0,200)},timestamp:Date.now(),hypothesisId:'H1,H3,H4,H5'})}).catch(()=>{});
        // #endregion
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
