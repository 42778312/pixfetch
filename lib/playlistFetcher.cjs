const ytpl = require('@distube/ytpl');
const { getPlaylistInfoWithYtDlp, mapYtDlpToPlaylistInfo } = require('./ytdlp');

function buildPlaylistUrl(playlistId) {
  return `https://www.youtube.com/playlist?list=${playlistId}`;
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function fetchPlaylistInfo(playlistId) {
  const playlistUrl = buildPlaylistUrl(playlistId);
  // #region agent log
  fetch('http://127.0.0.1:7715/ingest/24a1135b-fca3-4f00-9f43-cc6c874b060c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'46931b'},body:JSON.stringify({sessionId:'46931b',location:'playlistFetcher.cjs:fetchPlaylistInfo:entry',message:'fetchPlaylistInfo called',data:{playlistId,playlistUrl},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
  // #endregion
  let playlist;
  try {
    playlist = await ytpl(playlistUrl, { limit: Infinity });
    // #region agent log
    fetch('http://127.0.0.1:7715/ingest/24a1135b-fca3-4f00-9f43-cc6c874b060c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'46931b'},body:JSON.stringify({sessionId:'46931b',location:'playlistFetcher.cjs:fetchPlaylistInfo:ytpl-success',message:'ytpl succeeded',data:{playlistId,itemCount:playlist?.items?.length,title:playlist?.title},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
  } catch (ytplError) {
    // #region agent log
    fetch('http://127.0.0.1:7715/ingest/24a1135b-fca3-4f00-9f43-cc6c874b060c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'46931b'},body:JSON.stringify({sessionId:'46931b',location:'playlistFetcher.cjs:fetchPlaylistInfo:ytpl-error',message:'ytpl failed, trying yt-dlp fallback',data:{playlistId,errorName:ytplError?.name,errorMessage:ytplError?.message?.slice(0,200)},timestamp:Date.now(),hypothesisId:'H1,H5',runId:'post-fix'})}).catch(()=>{});
    // #endregion
    try {
      const data = await getPlaylistInfoWithYtDlp(playlistUrl);
      const mapped = mapYtDlpToPlaylistInfo(data, playlistId);
      // #region agent log
      fetch('http://127.0.0.1:7715/ingest/24a1135b-fca3-4f00-9f43-cc6c874b060c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'46931b'},body:JSON.stringify({sessionId:'46931b',location:'playlistFetcher.cjs:fetchPlaylistInfo:ytdlp-success',message:'yt-dlp fallback succeeded',data:{playlistId,videosCount:mapped.videosCount,title:mapped.title},timestamp:Date.now(),hypothesisId:'H5',runId:'post-fix'})}).catch(()=>{});
      // #endregion
      return mapped;
    } catch (ytdlpError) {
      // #region agent log
      fetch('http://127.0.0.1:7715/ingest/24a1135b-fca3-4f00-9f43-cc6c874b060c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'46931b'},body:JSON.stringify({sessionId:'46931b',location:'playlistFetcher.cjs:fetchPlaylistInfo:ytdlp-error',message:'yt-dlp fallback also failed',data:{playlistId,errorMessage:ytdlpError?.message?.slice(0,200)},timestamp:Date.now(),hypothesisId:'H5',runId:'post-fix'})}).catch(()=>{});
      // #endregion
      throw ytplError;
    }
  }

  const videos = playlist.items.map((item) => ({
    id: item.id,
    title: item.title,
    author: item.author?.name || playlist.author?.name || 'Unknown',
    thumbnail: item.thumbnail || item.bestThumbnail?.url || `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`,
    duration: item.duration || formatDuration(item.durationSec),
    durationSec: item.durationSec,
    size: '—',
    status: 'queued',
  }));

  return {
    type: 'playlist',
    id: playlistId,
    title: playlist.title,
    author: playlist.author?.name || playlist.owner?.name || 'YouTube',
    thumbnail:
      playlist.thumbnails?.[0]?.url ||
      videos[0]?.thumbnail ||
      'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop&q=60',
    videosCount: videos.length,
    videos,
  };
}

module.exports = {
  fetchPlaylistInfo,
};
