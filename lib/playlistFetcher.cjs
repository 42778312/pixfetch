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
  let playlist;
  try {
    playlist = await ytpl(playlistUrl, { limit: Infinity });
  } catch (ytplError) {
    try {
      const data = await getPlaylistInfoWithYtDlp(playlistUrl);
      return mapYtDlpToPlaylistInfo(data, playlistId);
    } catch {
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
