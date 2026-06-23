export const ALLOWED_QUALITIES = ['1080p', '720p', '480p', '360p', 'Audio Only'];

export const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

export const DEFAULT_DOWNLOAD_CONCURRENCY = 2;

export function isValidVideoId(id) {
  return typeof id === 'string' && VIDEO_ID_REGEX.test(id);
}

export function isValidQuality(quality) {
  return ALLOWED_QUALITIES.includes(quality);
}

export function sanitizeFilename(title) {
  return (title || 'video').replace(/[\\/*?:"<>|]/g, '').trim() || 'video';
}
