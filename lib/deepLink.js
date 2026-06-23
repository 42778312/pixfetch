import { buildVideoUrl, buildPlaylistUrl } from './urlParser';
import { ALLOWED_QUALITIES, isValidVideoId, isValidQuality } from './constants';

export const DEFAULT_DEEP_LINK_QUALITY = '720p';

export function normalizeQuality(quality) {
  if (quality && isValidQuality(quality)) return quality;
  return DEFAULT_DEEP_LINK_QUALITY;
}

export function buildYoutubeUrl({ videoId, playlistId }) {
  if (videoId && playlistId) {
    return `${buildVideoUrl(videoId)}&list=${playlistId}`;
  }
  if (videoId) return buildVideoUrl(videoId);
  if (playlistId) return buildPlaylistUrl(playlistId);
  return null;
}

/**
 * Build home page deep link query path (leading slash + search string).
 */
export function buildHomeDeepLink({ youtubeUrl, quality = DEFAULT_DEEP_LINK_QUALITY, download = false, mode = null }) {
  if (!youtubeUrl) return '/';

  const params = new URLSearchParams();
  params.set('url', youtubeUrl);

  const normalizedQuality = normalizeQuality(quality);
  params.set('quality', normalizedQuality);

  if (download) {
    params.set('download', '1');
  }

  if (mode === 'video' || mode === 'playlist') {
    params.set('mode', mode);
  }

  return `/?${params.toString()}`;
}

export function buildWatchDeepLink({ videoId, playlistId, quality, download = true, mode = null }) {
  if (!videoId && !playlistId) return null;

  let resolvedMode = mode;
  if (!resolvedMode) {
    if (videoId && playlistId) resolvedMode = 'video';
    else if (playlistId) resolvedMode = 'playlist';
  }

  const youtubeUrl = buildYoutubeUrl({ videoId, playlistId });
  if (!youtubeUrl) return null;

  return buildHomeDeepLink({
    youtubeUrl,
    quality,
    download,
    mode: resolvedMode,
  });
}

export function buildVideoDeepLink(videoId, options = {}) {
  if (!isValidVideoId(videoId)) return null;
  return buildHomeDeepLink({
    youtubeUrl: buildVideoUrl(videoId),
    quality: options.quality,
    download: options.download !== false,
  });
}

export function buildPlaylistDeepLink(playlistId, options = {}) {
  if (!playlistId || typeof playlistId !== 'string') return null;
  return buildHomeDeepLink({
    youtubeUrl: buildPlaylistUrl(playlistId),
    quality: options.quality,
    download: options.download !== false,
    mode: 'playlist',
  });
}

export function pickFormatForQuality(formats, quality) {
  if (!formats?.length) return null;
  const normalized = normalizeQuality(quality);
  const exact = formats.find((f) => f.quality === normalized);
  if (exact) return exact;
  return formats[0];
}

export function parseDeepLinkFlags(searchParams) {
  const quality = normalizeQuality(searchParams.get('quality'));
  const autoDownload = searchParams.get('download') === '1';
  const mode = searchParams.get('mode');
  const explicitMode = mode === 'video' || mode === 'playlist' ? mode : null;

  return { quality, autoDownload, mode: explicitMode };
}

export { ALLOWED_QUALITIES, isValidVideoId };
