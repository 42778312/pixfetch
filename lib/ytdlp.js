const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PassThrough } = require('stream');
const { getDownloadsDir, getBinDir } = require('./storagePaths');

function ensureDir(dir) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {
    // ignore on read-only or quota-limited runtimes
  }
}

function getYtDlpBinaryName() {
  if (process.platform === 'win32') return 'yt-dlp.exe';
  if (process.platform === 'linux') return 'yt-dlp_linux';
  if (process.platform === 'darwin') return 'yt-dlp_macos';
  return 'yt-dlp';
}

function getYtDlpDownloadUrl() {
  if (process.platform === 'win32') {
    return 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
  }
  if (process.platform === 'linux') {
    return 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';
  }
  if (process.platform === 'darwin') {
    return 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos';
  }
  return 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
}

function isPythonScript(filePath) {
  try {
    const head = fs.readFileSync(filePath, { encoding: 'utf8' }).slice(0, 24);
    return head.startsWith('#!');
  } catch {
    return false;
  }
}

function getDeploymentBinaryPath() {
  return path.join(process.cwd(), 'bin', getYtDlpBinaryName());
}

function getBundledBinaryPath() {
  return path.join(getBinDir(), getYtDlpBinaryName());
}

function findYtDlpBinary() {
  const deployment = getDeploymentBinaryPath();
  if (fs.existsSync(deployment)) return deployment;

  const bundled = getBundledBinaryPath();
  if (fs.existsSync(bundled)) return bundled;

  const envPath = process.env.YT_DLP_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  const cwdExe = path.join(process.cwd(), 'yt-dlp.exe');
  if (fs.existsSync(cwdExe)) return cwdExe;

  return null;
}

async function ensureYtDlpBinary() {
  const found = findYtDlpBinary();
  if (found && !(process.platform === 'linux' && isPythonScript(found))) {
    // #region agent log
    fetch('http://127.0.0.1:7715/ingest/24a1135b-fca3-4f00-9f43-cc6c874b060c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'07c1a4'},body:JSON.stringify({sessionId:'07c1a4',location:'lib/ytdlp.js:ensureYtDlpBinary',message:'binary resolved',data:{binary:found,platform:process.platform,size:fs.existsSync(found)?fs.statSync(found).size:0,isPythonScript:fs.existsSync(found)?isPythonScript(found):null},timestamp:Date.now(),hypothesisId:'H1-H3'})}).catch(()=>{});
    // #endregion
    return found;
  }

  const bundled = getBundledBinaryPath();
  const binDir = getBinDir();
  ensureDir(binDir);
  const downloadUrl = getYtDlpDownloadUrl();

  const res = await fetch(downloadUrl);
  if (!res.ok) {
    throw new Error(`Failed to download yt-dlp: HTTP ${res.status}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(bundled, buffer);
  if (process.platform !== 'win32') {
    fs.chmodSync(bundled, 0o755);
  }

  return bundled;
}

function formatSectionTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function runYtDlp(args, { onProgress, timeoutMs = 300000, binary = null } = {}) {
  return new Promise((resolve, reject) => {
    const resolvedBinary = binary || findYtDlpBinary();
    if (!resolvedBinary) {
      reject(new Error('yt-dlp not found'));
      return;
    }

    const proc = spawn(resolvedBinary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        proc.kill('SIGKILL');
        reject(new Error('yt-dlp timed out'));
      }
    }, timeoutMs);

    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      const progressMatch = text.match(/(\d+\.?\d*)%/);
      if (progressMatch && onProgress) {
        onProgress(parseFloat(progressMatch[1]));
      }
    });

    proc.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err.code === 'ENOENT') reject(new Error('yt-dlp not found'));
      else reject(err);
    });

    proc.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
    });
  });
}

async function isYtDlpAvailable() {
  try {
    const binary = await ensureYtDlpBinary();
    await runYtDlp(['--version'], { timeoutMs: 15000, binary });
    return true;
  } catch {
    return false;
  }
}

function streamVideoWithYtDlp(videoId, quality, { startSeconds = 0, endSeconds = null } = {}) {
  const binary = findYtDlpBinary();
  if (!binary) throw new Error('yt-dlp not found');

  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const isAudio = quality === 'Audio Only' || quality === 'mp3';
  const height = parseInt(quality, 10);

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

  const output = new PassThrough();
  const proc = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';

  proc.stdout.pipe(output);
  proc.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  proc.on('error', (err) => output.destroy(err));
  proc.on('close', (code) => {
    if (code !== 0 && !output.destroyed) {
      output.destroy(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
    }
  });

  return {
    stream: output,
    contentType: isAudio ? 'audio/mpeg' : 'video/mp4',
    ext: isAudio ? 'mp3' : 'mp4',
  };
}

async function getPlaylistInfoWithYtDlp(playlistUrl) {
  const binary = await ensureYtDlpBinary();

  return new Promise((resolve, reject) => {
    const proc = spawn(binary, ['-J', '--flat-playlist', '--no-warnings', playlistUrl], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `yt-dlp playlist info failed with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(err);
      }
    });
  });
}

function mapYtDlpToPlaylistInfo(data, playlistId) {
  const author = data.uploader || data.channel || 'YouTube';
  const videos = (data.entries || [])
    .filter((entry) => entry?.id)
    .map((entry) => {
      const durationSec = entry.duration || 0;
      return {
        id: entry.id,
        title: entry.title || 'Untitled',
        author,
        thumbnail:
          entry.thumbnails?.[entry.thumbnails.length - 1]?.url ||
          entry.thumbnail ||
          `https://img.youtube.com/vi/${entry.id}/mqdefault.jpg`,
        duration: formatSectionTime(durationSec),
        durationSec,
        size: '—',
        status: 'queued',
      };
    });

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

async function getVideoInfoWithYtDlp(url) {
  const binary = await ensureYtDlpBinary();

  return new Promise((resolve, reject) => {
    // #region agent log
    fetch('http://127.0.0.1:7715/ingest/24a1135b-fca3-4f00-9f43-cc6c874b060c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'07c1a4'},body:JSON.stringify({sessionId:'07c1a4',location:'lib/ytdlp.js:getVideoInfoWithYtDlp',message:'spawning yt-dlp',data:{binary,url,platform:process.platform},timestamp:Date.now(),hypothesisId:'H1-H2'})}).catch(()=>{});
    // #endregion
    const proc = spawn(binary, ['-j', '--no-playlist', '--no-warnings', url], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        const errMsg = stderr.trim() || `yt-dlp info failed with code ${code}`;
        // #region agent log
        fetch('http://127.0.0.1:7715/ingest/24a1135b-fca3-4f00-9f43-cc6c874b060c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'07c1a4'},body:JSON.stringify({sessionId:'07c1a4',location:'lib/ytdlp.js:getVideoInfoWithYtDlp:close',message:'yt-dlp failed',data:{code,stderr:errMsg.slice(0,200),binary},timestamp:Date.now(),hypothesisId:'H1-H4'})}).catch(()=>{});
        // #endregion
        reject(new Error(errMsg));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(err);
      }
    });
  });
}

function mapYtDlpToVideoInfo(data) {
  const formats = [];
  const heights = [1080, 720, 480, 360];

  for (const height of heights) {
    const match = (data.formats || []).find(
      (f) => f.height === height && f.vcodec !== 'none' && f.ext === 'mp4'
    );
    if (match) {
      formats.push({
        quality: `${height}p`,
        ext: 'mp4',
        size: match.filesize
          ? `${(match.filesize / (1024 * 1024)).toFixed(1)} MB`
          : 'Unknown size',
        fps: match.fps || 30,
        itag: match.format_id,
        hasAudio: match.acodec !== 'none',
      });
    }
  }

  const audioFormat = (data.formats || []).find((f) => f.acodec !== 'none' && f.vcodec === 'none');
  if (audioFormat) {
    formats.push({
      quality: 'Audio Only',
      ext: 'mp3',
      size: audioFormat.filesize
        ? `${(audioFormat.filesize / (1024 * 1024)).toFixed(1)} MB`
        : 'Unknown size',
      fps: null,
      itag: audioFormat.format_id,
      hasAudio: true,
    });
  }

  if (formats.length === 0) {
    formats.push({ quality: '720p', ext: 'mp4', size: 'Auto', fps: 30, itag: 'best', hasAudio: true });
  }

  const duration = data.duration || 0;
  const mins = Math.floor(duration / 60);
  const secs = Math.floor(duration % 60);

  return {
    type: 'video',
    id: data.id,
    title: data.title,
    author: data.uploader || data.channel || 'Unknown Creator',
    thumbnail: data.thumbnail,
    duration:
      duration >= 3600
        ? `${Math.floor(duration / 3600)}:${String(mins % 60).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
        : `${mins}:${String(secs).padStart(2, '0')}`,
    durationSeconds: duration,
    formats,
  };
}

async function downloadWithYtDlp(videoId, quality, onProgress) {
  await ensureYtDlpBinary();

  const downloadsDir = getDownloadsDir();
  ensureDir(downloadsDir);

  const ext = quality === 'Audio Only' ? 'mp3' : 'mp4';
  const label = quality === 'Audio Only' ? 'Audio Only' : quality;
  const finalPath = path.join(downloadsDir, `${videoId}_${label}.${ext}`);
  if (fs.existsSync(finalPath) && fs.statSync(finalPath).size > 0) {
    onProgress?.({ status: 'completed', progress: 100, speed: '0 MB/s', eta: '0s', videoId });
    return finalPath;
  }

  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const isAudio = quality === 'Audio Only';
  const outputTemplate = isAudio
    ? path.join(downloadsDir, `${videoId}_Audio Only.%(ext)s`)
    : path.join(downloadsDir, `${videoId}_${quality}.%(ext)s`);

  const formatArg = isAudio
    ? 'bestaudio/best'
    : `bestvideo[height<=${parseInt(quality, 10)}][ext=mp4]+bestaudio/best[height<=${parseInt(quality, 10)}]`;

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

  onProgress?.({ status: 'downloading', progress: 5, speed: '0 MB/s', eta: 'Downloading via yt-dlp...' });

  await runYtDlp(args, {
    onProgress: (pct) => {
      onProgress?.({
        status: 'downloading',
        progress: Math.min(Math.round(pct), 98),
        speed: '0 MB/s',
        eta: `${Math.round(pct)}%`,
        videoId,
      });
    },
  });

  const resolvedPath = path.join(downloadsDir, `${videoId}_${isAudio ? 'Audio Only' : quality}.${ext}`);
  if (!fs.existsSync(resolvedPath) && isAudio) {
    const altPath = path.join(downloadsDir, `${videoId}_Audio Only.mp3`);
    if (fs.existsSync(altPath)) return altPath;
  }

  onProgress?.({ status: 'completed', progress: 100, speed: '0 MB/s', eta: '0s', videoId });
  return resolvedPath;
}

module.exports = {
  ensureYtDlpBinary,
  isYtDlpAvailable,
  getPlaylistInfoWithYtDlp,
  mapYtDlpToPlaylistInfo,
  getVideoInfoWithYtDlp,
  mapYtDlpToVideoInfo,
  downloadWithYtDlp,
  streamVideoWithYtDlp,
};
