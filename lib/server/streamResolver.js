import { spawn } from 'child_process';
import { findYtdlpBinary, formatSectionTime } from './ytdlp.js';

export async function streamVideo(videoId, quality, { startSeconds = 0, endSeconds = null } = {}) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const isAudio = quality === 'Audio Only' || quality === 'mp3';
  const height = isAudio ? 0 : parseInt(quality.replace('p', ''), 10);

  const formatArg = isAudio
    ? 'bestaudio/best'
    : `bestvideo[height<=${height}][ext=mp4]+bestaudio/best[height<=${height}]/best[height<=${height}]`;

  const args = [
    url,
    '-f',
    formatArg,
    '--merge-output-format',
    isAudio ? 'mp3' : 'mp4',
    '-o',
    '-',
    '--no-playlist',
    '--no-warnings',
    '--no-progress',
  ];
  if (isAudio) {
    args.push('--extract-audio', '--audio-format', 'mp3');
  }

  if (startSeconds > 0 || (endSeconds !== null && endSeconds > startSeconds)) {
    const startLabel = formatSectionTime(startSeconds);
    const endLabel = formatSectionTime(endSeconds ?? startSeconds + 60);
    args.push('--download-sections', `*${startLabel}-${endLabel}`);
  }

  const binary = findYtdlpBinary();
  const proc = spawn(binary[0], [...binary.slice(1), ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const contentType = isAudio ? 'audio/mpeg' : 'video/mp4';
  const ext = isAudio ? 'mp3' : 'mp4';

  async function* iterStdout() {
    try {
      for await (const chunk of proc.stdout) {
        yield chunk;
      }
      const code = await new Promise((resolve) => proc.on('close', resolve));
      if (code !== 0 && code !== null) {
        const stderr = proc.stderr ? await readAll(proc.stderr) : '';
        throw new Error(stderr.trim() || `yt-dlp exited ${code}`);
      }
    } finally {
      if (!proc.killed) proc.kill('SIGTERM');
    }
  }

  return { byteIter: iterStdout(), contentType, ext };
}

async function readAll(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString();
}
