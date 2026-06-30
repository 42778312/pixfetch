import fs from 'fs';
import path from 'path';
import { cleanupOldDownloads, getFinalPath } from './storage.js';
import { runYtdlp } from './ytdlp.js';

export async function downloadVideo(videoId, quality, onProgress, downloadId) {
  cleanupOldDownloads();

  const finalPath = getFinalPath(videoId, quality);
  if (fs.existsSync(finalPath) && fs.statSync(finalPath).size > 0) {
    onProgress({
      status: 'completed',
      progress: 100,
      speed: '0 MB/s',
      eta: '0s',
      videoId,
    });
    return finalPath;
  }

  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const isAudio = quality === 'Audio Only';
  const ext = isAudio ? 'mp3' : 'mp4';
  const label = isAudio ? 'Audio Only' : quality;
  const outputTemplate = path.join(path.dirname(finalPath), `${videoId}_${label}.${ext}`);

  const height = parseInt(quality.replace('p', ''), 10);
  const formatArg = isAudio
    ? 'bestaudio/best'
    : `bestvideo[height<=${height}][ext=mp4]+bestaudio/best[height<=${height}]`;

  const args = [
    url,
    '-f',
    formatArg,
    '--merge-output-format',
    isAudio ? 'mp3' : 'mp4',
    '-o',
    outputTemplate,
    '--no-playlist',
    '--newline',
    '--continue',
  ];
  if (isAudio) {
    args.push('--extract-audio', '--audio-format', 'mp3');
  }

  onProgress({
    status: 'connecting',
    progress: 0,
    speed: '0 MB/s',
    eta: 'Analyzing streams...',
  });
  onProgress({
    status: 'downloading',
    progress: 5,
    speed: '0 MB/s',
    eta: 'Downloading via yt-dlp...',
  });

  const progressCb = (pct) => {
    onProgress({
      status: 'downloading',
      progress: Math.min(Math.round(pct), 98),
      speed: '0 MB/s',
      eta: `${Math.round(pct)}%`,
      videoId,
    });
  };

  await runYtdlp(args, { onProgress: progressCb, downloadId });

  if (!fs.existsSync(finalPath) && isAudio) {
    const alt = path.join(path.dirname(finalPath), `${videoId}_Audio Only.mp3`);
    if (fs.existsSync(alt)) {
      onProgress({
        status: 'completed',
        progress: 100,
        speed: '0 MB/s',
        eta: '0s',
        videoId,
      });
      return alt;
    }
  }

  onProgress({
    status: 'completed',
    progress: 100,
    speed: '0 MB/s',
    eta: '0s',
    videoId,
  });
  return finalPath;
}
