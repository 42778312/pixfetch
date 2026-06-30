import { buildPlaylistUrl } from '@/lib/urlParser';
import {
  mapYtdlpToPlaylistInfo,
  mapYtdlpToVideoInfo,
  runYtdlpJson,
} from './ytdlp.js';

export async function fetchVideoInfo(url) {
  const data = await runYtdlpJson(['-j', '--no-playlist', '--no-warnings', url]);
  return mapYtdlpToVideoInfo(data);
}

export async function fetchPlaylistInfo(playlistId) {
  const playlistUrl = buildPlaylistUrl(playlistId);
  const data = await runYtdlpJson(
    ['-J', '--flat-playlist', '--no-warnings', playlistUrl],
    180_000
  );
  return mapYtdlpToPlaylistInfo(data, playlistId);
}
