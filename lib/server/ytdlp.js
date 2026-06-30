import { spawn } from 'child_process';
import { getSettings } from './config.js';
const activeDownloads = new Map();

export function registerDownload(downloadId, cancelFn) {
  activeDownloads.set(downloadId, cancelFn);
}

export function unregisterDownload(downloadId) {
  activeDownloads.delete(downloadId);
}

export function cancelDownload(downloadId) {
  const cancelFn = activeDownloads.get(downloadId);
  if (cancelFn) {
    cancelFn();
    activeDownloads.delete(downloadId);
    return true;
  }
  return false;
}

export function findYtdlpBinary() {
  const { ytdlpPath } = getSettings();
  if (ytdlpPath) return [ytdlpPath];
  return ['yt-dlp'];
}

export function formatSectionTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function runProcess(binary, args, { onProgress, timeoutMs = 300_000, downloadId } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(binary[0], [...binary.slice(1), ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let cancelled = false;
    const stderrChunks = [];

    const cancel = () => {
      cancelled = true;
      proc.kill('SIGKILL');
    };

    if (downloadId) registerDownload(downloadId, cancel);

    const timer = setTimeout(() => {
      cancel();
      reject(new Error('yt-dlp timed out'));
    }, timeoutMs);

    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderrChunks.push(text);
      if (onProgress) {
        for (const match of text.matchAll(/(\d+\.?\d*)%/g)) {
          onProgress(parseFloat(match[1]));
        }
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      if (downloadId) unregisterDownload(downloadId);
      reject(err);
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (downloadId) unregisterDownload(downloadId);
      if (cancelled) {
        reject(new Error('Download cancelled'));
        return;
      }
      if (code !== 0) {
        const stderr = stderrChunks.join('').trim();
        reject(new Error(stderr || `yt-dlp exited with code ${code}`));
        return;
      }
      resolve(stderrChunks.join(''));
    });
  });
}

export async function runYtdlp(args, options = {}) {
  const binary = findYtdlpBinary();
  return runProcess(binary, args, options);
}

export async function runYtdlpJson(args, timeoutMs = 120_000) {
  const binary = findYtdlpBinary();
  return new Promise((resolve, reject) => {
    const proc = spawn(binary[0], [...binary.slice(1), ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('yt-dlp timed out'));
    }, timeoutMs);

    const stdoutChunks = [];
    const stderrChunks = [];

    proc.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
    proc.stderr.on('data', (chunk) => stderrChunks.push(chunk));

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderrChunks.join('').trim() || `yt-dlp exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(stdoutChunks).toString()));
      } catch (err) {
        reject(err);
      }
    });
  });
}

export async function isYtdlpAvailable() {
  try {
    const binary = findYtdlpBinary();
    return await new Promise((resolve) => {
      const proc = spawn(binary[0], [...binary.slice(1), '--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const timer = setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 15_000);
      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve(code === 0);
      });
      proc.on('error', () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
  } catch {
    return false;
  }
}

export async function isFfmpegAvailable() {
  try {
    return await new Promise((resolve) => {
      const proc = spawn('ffmpeg', ['-version'], { stdio: ['ignore', 'pipe', 'pipe'] });
      const timer = setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 10_000);
      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve(code === 0);
      });
      proc.on('error', () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
  } catch {
    return false;
  }
}

export function mapYtdlpToVideoInfo(data) {
  const formats = [];
  for (const height of [1080, 720, 480, 360]) {
    const match = (data.formats || []).find(
      (f) => f.height === height && f.vcodec !== 'none' && f.ext === 'mp4'
    );
    if (match) {
      const filesize = match.filesize || match.filesize_approx;
      formats.push({
        quality: `${height}p`,
        ext: 'mp4',
        size: filesize ? `${(filesize / (1024 * 1024)).toFixed(1)} MB` : 'Unknown size',
        fps: match.fps || 30,
        itag: match.format_id,
        hasAudio: match.acodec !== 'none',
      });
    }
  }

  const audioFormat = (data.formats || []).find(
    (f) => f.acodec !== 'none' && f.vcodec === 'none'
  );
  if (audioFormat) {
    const filesize = audioFormat.filesize || audioFormat.filesize_approx;
    formats.push({
      quality: 'Audio Only',
      ext: 'mp3',
      size: filesize ? `${(filesize / (1024 * 1024)).toFixed(1)} MB` : 'Unknown size',
      fps: null,
      itag: audioFormat.format_id,
      hasAudio: true,
    });
  }

  if (formats.length === 0) {
    formats.push({
      quality: '720p',
      ext: 'mp4',
      size: 'Auto',
      fps: 30,
      itag: 'best',
      hasAudio: true,
    });
  }

  const duration = data.duration || 0;
  const mins = Math.floor(duration / 60);
  const secs = Math.floor(duration % 60);
  const durationStr =
    duration >= 3600
      ? `${Math.floor(duration / 3600)}:${String(mins % 60).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      : `${mins}:${String(secs).padStart(2, '0')}`;

  return {
    type: 'video',
    id: data.id,
    title: data.title,
    author: data.uploader || data.channel || 'Unknown Creator',
    thumbnail: data.thumbnail,
    duration: durationStr,
    durationSeconds: duration,
    formats,
  };
}

export function mapYtdlpToPlaylistInfo(data, playlistId) {
  const author = data.uploader || data.channel || 'YouTube';
  const videos = [];
  for (const entry of data.entries || []) {
    if (!entry?.id) continue;
    const durationSec = entry.duration || 0;
    videos.push({
      id: entry.id,
      title: entry.title || 'Untitled',
      author,
      thumbnail:
        (entry.thumbnails?.at(-1)?.url || entry.thumbnail) ||
        `https://img.youtube.com/vi/${entry.id}/mqdefault.jpg`,
      duration: formatSectionTime(durationSec),
      durationSec,
      size: '—',
      status: 'queued',
    });
  }

  return {
    type: 'playlist',
    id: playlistId,
    title: data.title || 'YouTube Playlist',
    author,
    thumbnail:
      data.thumbnails?.[0]?.url ||
      videos[0]?.thumbnail ||
      'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop&q=60',
    videosCount: videos.length,
    videos,
  };
}
