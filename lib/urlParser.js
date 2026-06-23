const VIDEO_ID_PATTERN = /[a-zA-Z0-9_-]{11}/g;

const URL_PATTERNS = [
  /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/|music\.youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
];

const PLAYLIST_PATTERN = /[?&]list=([a-zA-Z0-9_-]+)/;

/**
 * Parse YouTube input into structured IDs.
 * @param {string} input - Raw URL, ID, or messy paste
 * @returns {{ videoId: string|null, playlistId: string|null, normalizedUrl: string|null, mode: 'video'|'playlist'|'ambiguous'|null }}
 */
export function parseYoutubeInput(input) {
  if (!input || typeof input !== 'string') {
    return { videoId: null, playlistId: null, normalizedUrl: null, mode: null };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return { videoId: null, playlistId: null, normalizedUrl: null, mode: null };
  }

  let videoId = null;
  let playlistId = null;

  const playlistMatch = trimmed.match(PLAYLIST_PATTERN);
  if (playlistMatch) {
    playlistId = playlistMatch[1];
  }

  for (const pattern of URL_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match && match[1]?.length === 11) {
      videoId = match[1];
      break;
    }
  }

  if (!videoId) {
    const bareMatch = trimmed.match(/^[a-zA-Z0-9_-]{11}$/);
    if (bareMatch) {
      videoId = bareMatch[0];
    }
  }

  if (!videoId) {
    const allIds = trimmed.match(VIDEO_ID_PATTERN) || [];
    const uniqueIds = [...new Set(allIds)];
    if (uniqueIds.length === 1) {
      videoId = uniqueIds[0];
    }
  }

  let mode = null;
  if (videoId && playlistId) {
    mode = 'ambiguous';
  } else if (playlistId) {
    mode = 'playlist';
  } else if (videoId) {
    mode = 'video';
  }

  let normalizedUrl = null;
  if (videoId && mode === 'video') {
    normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;
  } else if (playlistId && mode === 'playlist') {
    normalizedUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
  } else if (videoId && playlistId) {
    normalizedUrl = `https://www.youtube.com/watch?v=${videoId}&list=${playlistId}`;
  }

  return { videoId, playlistId, normalizedUrl, mode };
}

export function buildVideoUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function buildPlaylistUrl(playlistId) {
  return `https://www.youtube.com/playlist?list=${playlistId}`;
}

export function isLikelyYoutubeInput(input) {
  const parsed = parseYoutubeInput(input);
  return parsed.mode !== null;
}

export function getValidationHint(input) {
  if (!input?.trim()) return null;
  const parsed = parseYoutubeInput(input);
  if (parsed.mode) return null;
  return 'Could not find a valid YouTube video or playlist ID in this input.';
}
