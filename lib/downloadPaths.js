const fs = require('fs');
const path = require('path');

const downloadsDir = path.join(process.cwd(), 'downloads');

function getDownloadsDir() {
  return downloadsDir;
}

function getFinalPath(videoId, quality) {
  const isAudioOnly = quality === 'Audio Only' || quality === 'mp3';
  const ext = isAudioOnly ? 'mp3' : 'mp4';
  const label = isAudioOnly ? 'Audio Only' : quality;
  return path.join(downloadsDir, `${videoId}_${label}.${ext}`);
}

function getTempPaths(videoId) {
  return [
    path.join(downloadsDir, `temp_${videoId}_video.mp4`),
    path.join(downloadsDir, `temp_${videoId}_audio.webm`),
  ];
}

function parseSizeToBytes(sizeStr) {
  if (!sizeStr || sizeStr === 'Auto' || sizeStr === 'Unknown size') return 0;
  const match = String(sizeStr).match(/^([\d.]+)\s*(B|KB|MB|GB)$/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const multipliers = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };
  return Math.round(value * (multipliers[unit] || 1));
}

function getDownloadStatus(videoId, quality, expectedSizeStr = null) {
  const finalPath = getFinalPath(videoId, quality);
  const expectedBytes = parseSizeToBytes(expectedSizeStr);

  if (fs.existsSync(finalPath)) {
    const stat = fs.statSync(finalPath);
    if (stat.size > 0) {
      return {
        status: 'complete',
        bytesDownloaded: stat.size,
        totalBytes: stat.size,
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

  return { status: 'none', bytesDownloaded: 0, totalBytes: expectedBytes || null, progress: 0 };
}

module.exports = {
  getDownloadsDir,
  getFinalPath,
  getTempPaths,
  parseSizeToBytes,
  getDownloadStatus,
};
