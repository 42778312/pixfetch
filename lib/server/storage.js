import fs from 'fs';
import path from 'path';
import { getSettings } from './config.js';

const CLEANUP_MAX_AGE_SEC = 24 * 60 * 60;

export function getDownloadsDir() {
  const { downloadsDir } = getSettings();
  fs.mkdirSync(downloadsDir, { recursive: true });
  return downloadsDir;
}

export function getFinalPath(videoId, quality) {
  const isAudio = quality === 'Audio Only' || quality === 'mp3';
  const ext = isAudio ? 'mp3' : 'mp4';
  const label = isAudio ? 'Audio Only' : quality;
  return path.join(getDownloadsDir(), `${videoId}_${label}.${ext}`);
}

export function getTempPaths(videoId) {
  const downloads = getDownloadsDir();
  return [
    path.join(downloads, `temp_${videoId}_video.mp4`),
    path.join(downloads, `temp_${videoId}_audio.webm`),
  ];
}

export function parseSizeToBytes(sizeStr) {
  if (!sizeStr || sizeStr === 'Auto' || sizeStr === 'Unknown size' || sizeStr === '—') {
    return 0;
  }
  const match = String(sizeStr).match(/^([\d.]+)\s*(B|KB|MB|GB)$/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const multipliers = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };
  return Math.round(value * (multipliers[unit] || 1));
}

export function getDownloadStatus(videoId, quality, expectedSizeStr) {
  const finalPath = getFinalPath(videoId, quality);
  const expectedBytes = parseSizeToBytes(expectedSizeStr);

  if (fs.existsSync(finalPath)) {
    const size = fs.statSync(finalPath).size;
    if (size > 0) {
      return {
        status: 'complete',
        bytesDownloaded: size,
        totalBytes: size,
        progress: 100,
      };
    }
  }

  let partialBytes = 0;
  const seen = new Set();
  for (const tempPath of getTempPaths(videoId)) {
    if (seen.has(tempPath) || !fs.existsSync(tempPath)) continue;
    seen.add(tempPath);
    partialBytes += fs.statSync(tempPath).size;
  }

  if (partialBytes > 0) {
    const progress =
      expectedBytes > 0 ? Math.min(Math.round((partialBytes / expectedBytes) * 100), 99) : 0;
    return {
      status: 'partial',
      bytesDownloaded: partialBytes,
      totalBytes: expectedBytes || null,
      progress,
    };
  }

  return {
    status: 'none',
    bytesDownloaded: 0,
    totalBytes: expectedBytes || null,
    progress: 0,
  };
}

export function cleanupOldDownloads() {
  const downloads = getDownloadsDir();
  if (!fs.existsSync(downloads)) return;
  const now = Date.now() / 1000;
  try {
    for (const entry of fs.readdirSync(downloads)) {
      const filePath = path.join(downloads, entry);
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) continue;
      if (now - stat.mtimeMs / 1000 > CLEANUP_MAX_AGE_SEC) {
        fs.unlinkSync(filePath);
      }
    }
  } catch {
    // ignore cleanup errors
  }
}
