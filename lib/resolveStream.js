import { streamVideoToResponse } from '@/lib/downloader';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export async function resolveStream(videoId, quality, clipOptions = {}) {
  const { ensureYtDlpBinary, streamVideoWithYtDlp } = require('@/lib/ytdlp');

  try {
    await ensureYtDlpBinary();
    return streamVideoWithYtDlp(videoId, quality, clipOptions);
  } catch {
    return streamVideoToResponse(videoId, quality, clipOptions);
  }
}
