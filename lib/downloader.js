const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { PassThrough } = require('stream');
const ytdl = require('@distube/ytdl-core');
const ffmpegPath = require('ffmpeg-static');
const { getYtdlOptions } = require('./ytdlAgent');
const { registerDownload, unregisterDownload } = require('./downloadRegistry');
const { getFinalPath, getTempPaths, parseSizeToBytes, getDownloadsDir } = require('./downloadPaths');

const CLEANUP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function ensureDownloadsDir() {
  const downloadsDir = getDownloadsDir();
  try {
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }
  } catch {
    // ignore on read-only runtimes
  }
  return downloadsDir;
}

function cleanupOldDownloads() {
  try {
    const downloadsDir = getDownloadsDir();
    if (!fs.existsSync(downloadsDir)) return;

    const now = Date.now();
    for (const file of fs.readdirSync(downloadsDir)) {
      const filePath = path.join(downloadsDir, file);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > CLEANUP_MAX_AGE_MS) {
        fs.unlinkSync(filePath);
      }
    }
  } catch {
    // ignore cleanup errors
  }
}

function formatBytes(bytes) {
  if (!bytes) return 'Unknown size';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${['B', 'KB', 'MB', 'GB'][i]}`;
}

function getDurationString(seconds) {
  if (!seconds) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function parseDurationToSeconds(durationStr) {
  if (!durationStr) return 0;
  const parts = durationStr.split(':').map(Number);
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function selectBestAudio(audioFormats) {
  return audioFormats.reduce((best, current) => {
    return (current.audioBitrate || 0) > (best.audioBitrate || 0) ? current : best;
  }, audioFormats[0] || {});
}

function selectVideoFormat(info, quality) {
  const targetHeight = parseInt(quality, 10);
  const matchingFormats = info.formats.filter((f) => f.hasVideo && f.height === targetHeight);
  if (matchingFormats.length === 0) return null;

  return matchingFormats.sort((a, b) => {
    if (a.container === 'mp4' && b.container !== 'mp4') return -1;
    if (a.container !== 'mp4' && b.container === 'mp4') return 1;
    return parseInt(b.contentLength || 0, 10) - parseInt(a.contentLength || 0, 10);
  })[0];
}

async function getVideoInfo(url) {
  const info = await ytdl.getInfo(url, getYtdlOptions());
  const details = info.videoDetails;

  const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
  const bestAudio = selectBestAudio(audioFormats);
  const bestAudioSize = parseInt(bestAudio.contentLength || 0, 10);

  const targetQualities = [
    { label: '1080p', height: 1080 },
    { label: '720p', height: 720 },
    { label: '480p', height: 480 },
    { label: '360p', height: 360 },
  ];

  const formatsList = [];

  targetQualities.forEach((target) => {
    const matchingFormats = info.formats.filter((f) => f.hasVideo && f.height === target.height);
    if (matchingFormats.length > 0) {
      const bestVideo = matchingFormats.sort((a, b) => {
        if (a.container === 'mp4' && b.container !== 'mp4') return -1;
        if (a.container !== 'mp4' && b.container === 'mp4') return 1;
        return parseInt(b.contentLength || 0, 10) - parseInt(a.contentLength || 0, 10);
      })[0];

      const videoSize = parseInt(bestVideo.contentLength || 0, 10);
      const audioSize = bestVideo.hasAudio ? 0 : bestAudioSize;
      const totalSize = videoSize + audioSize;

      formatsList.push({
        quality: target.label,
        ext: 'mp4',
        size: formatBytes(totalSize),
        fps: bestVideo.fps || 30,
        itag: bestVideo.itag,
        hasAudio: bestVideo.hasAudio,
      });
    }
  });

  if (bestAudio && bestAudio.itag) {
    formatsList.push({
      quality: 'Audio Only',
      ext: 'mp3',
      size: formatBytes(bestAudioSize || 5000000),
      fps: null,
      itag: bestAudio.itag,
      hasAudio: true,
    });
  }

  if (formatsList.length === 0) {
    formatsList.push({
      quality: '720p',
      ext: 'mp4',
      size: 'Auto',
      fps: 30,
      itag: 22,
      hasAudio: true,
    });
  }

  return {
    type: 'video',
    id: details.videoId,
    title: details.title,
    author: details.author?.name || 'Unknown Creator',
    thumbnail: details.thumbnails?.[details.thumbnails.length - 1]?.url || details.thumbnails?.[0]?.url,
    duration: getDurationString(parseInt(details.lengthSeconds || 0, 10)),
    durationSeconds: parseInt(details.lengthSeconds || 0, 10),
    formats: formatsList,
  };
}

function createCancelContext(downloadId) {
  let isCancelled = false;
  const streams = [];
  const processes = [];

  const cancel = () => {
    if (isCancelled) return;
    isCancelled = true;
    streams.forEach((s) => {
      try {
        s.destroy();
      } catch {
        // ignore
      }
    });
    processes.forEach((p) => {
      try {
        p.kill('SIGKILL');
      } catch {
        // ignore
      }
    });
  };

  if (downloadId) {
    registerDownload(downloadId, cancel);
  }

  const trackStream = (stream) => {
    streams.push(stream);
    return stream;
  };

  const trackProcess = (proc) => {
    processes.push(proc);
    return proc;
  };

  const cleanup = () => {
    if (downloadId) unregisterDownload(downloadId);
  };

  return { isCancelled: () => isCancelled, cancel, trackStream, trackProcess, cleanup };
}

function downloadVideo(videoId, quality, onProgress, downloadId = null) {
  const downloadsDir = ensureDownloadsDir();
  cleanupOldDownloads();

  return new Promise((resolve, reject) => {
    let cleanUpOnFailure = () => {};
    const ctx = createCancelContext(downloadId);

    (async () => {
      try {
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        onProgress({ status: 'connecting', progress: 0, speed: '0 MB/s', eta: 'Analyzing streams...' });

        const isAudioOnly = quality === 'Audio Only' || quality === 'mp3';
        const existingPath = getFinalPath(videoId, quality);
        if (fs.existsSync(existingPath)) {
          const stat = fs.statSync(existingPath);
          if (stat.size > 0) {
            onProgress({ status: 'completed', progress: 100, speed: '0 MB/s', eta: '0s', videoId });
            resolve(existingPath);
            ctx.cleanup();
            return;
          }
        }

        let partialBytes = 0;
        for (const tempPath of getTempPaths(videoId)) {
          if (fs.existsSync(tempPath)) {
            partialBytes += fs.statSync(tempPath).size;
          }
        }

        const info = await ytdl.getInfo(url, getYtdlOptions());
        if (ctx.isCancelled()) return;

        const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
        const bestAudio = selectBestAudio(audioFormats);

        if (isAudioOnly) {
          if (!bestAudio) throw new Error('No audio streams found');

          const totalAudioSize = parseInt(bestAudio.contentLength || 0, 10);
          const tempAudioPath = path.join(downloadsDir, `temp_${videoId}_audio.webm`);
          const finalMp3Path = path.join(downloadsDir, `${videoId}_Audio Only.mp3`);

          cleanUpOnFailure = () => {
            if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
            if (fs.existsSync(finalMp3Path)) fs.unlinkSync(finalMp3Path);
          };

          onProgress({
            status: partialBytes > 0 ? 'downloading' : 'downloading',
            progress: partialBytes > 0
              ? Math.min(Math.round((partialBytes / (totalAudioSize || 1)) * 90), 89)
              : 5,
            speed: '0 MB/s',
            eta: partialBytes > 0 ? 'Resuming audio...' : 'Downloading audio stream...',
          });

          const audioStream = ctx.trackStream(ytdl(url, { format: bestAudio, ...getYtdlOptions() }));
          const audioFile = fs.createWriteStream(tempAudioPath);
          audioStream.pipe(audioFile);

          let lastTime = Date.now();
          let lastDownloaded = 0;

          audioStream.on('progress', (chunk, downloaded, total) => {
            if (ctx.isCancelled()) return;
            const totalSize = total || totalAudioSize;
            const now = Date.now();
            const duration = (now - lastTime) / 1000;
            if (duration >= 0.5) {
              const speedBytes = (downloaded - lastDownloaded) / duration;
              const speedMB = (speedBytes / (1024 * 1024)).toFixed(1);
              const remainingBytes = totalSize - downloaded;
              const etaSeconds = speedBytes > 0 ? Math.ceil(remainingBytes / speedBytes) : 0;
              onProgress({
                status: 'downloading',
                progress: Math.min(Math.round((downloaded / totalSize) * 90), 90),
                speed: `${speedMB} MB/s`,
                eta: `${etaSeconds}s`,
                videoId,
              });
              lastTime = now;
              lastDownloaded = downloaded;
            }
          });

          audioStream.on('end', () => {
            if (ctx.isCancelled()) return;
            audioFile.end();
            onProgress({ status: 'merging', progress: 92, speed: '0 MB/s', eta: 'Converting to MP3...' });

            const ffmpegProcess = ctx.trackProcess(
              spawn(ffmpegPath, ['-y', '-i', tempAudioPath, '-vn', '-c:a', 'libmp3lame', '-q:a', '2', finalMp3Path])
            );

            ffmpegProcess.on('close', (code) => {
              if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
              ctx.cleanup();
              if (ctx.isCancelled()) return;
              if (code === 0) {
                onProgress({ status: 'completed', progress: 100, speed: '0 MB/s', eta: '0s', videoId });
                resolve(finalMp3Path);
              } else {
                reject(new Error(`FFmpeg audio conversion failed with code ${code}`));
              }
            });

            ffmpegProcess.on('error', reject);
          });

          audioStream.on('error', (err) => {
            audioFile.end();
            reject(err);
          });
        } else {
          const videoFormat = selectVideoFormat(info, quality);
          if (!videoFormat) throw new Error(`No matching format for quality ${quality}`);

          if (videoFormat.hasAudio) {
            const totalSize = parseInt(videoFormat.contentLength || 0, 10);
            const finalVideoPath = path.join(downloadsDir, `${videoId}_${quality}.mp4`);

            cleanUpOnFailure = () => {
              if (fs.existsSync(finalVideoPath)) fs.unlinkSync(finalVideoPath);
            };

            onProgress({
              status: 'downloading',
              progress: partialBytes > 0
                ? Math.min(Math.round((partialBytes / (totalSize || 1)) * 98), 89)
                : 5,
              speed: '0 MB/s',
              eta: partialBytes > 0 ? 'Resuming video...' : 'Downloading video stream...',
            });

            const videoStream = ctx.trackStream(
              ytdl(url, { format: videoFormat, ...getYtdlOptions() })
            );
            const videoFile = fs.createWriteStream(finalVideoPath);
            videoStream.pipe(videoFile);

            let lastTime = Date.now();
            let lastDownloaded = 0;

            videoStream.on('progress', (chunk, downloaded, total) => {
              if (ctx.isCancelled()) return;
              const size = total || totalSize;
              const now = Date.now();
              const duration = (now - lastTime) / 1000;
              if (duration >= 0.5) {
                const speedBytes = (downloaded - lastDownloaded) / duration;
                const speedMB = (speedBytes / (1024 * 1024)).toFixed(1);
                const remainingBytes = size - downloaded;
                const etaSeconds = speedBytes > 0 ? Math.ceil(remainingBytes / speedBytes) : 0;
                onProgress({
                  status: 'downloading',
                  progress: Math.min(Math.round((downloaded / size) * 98), 98),
                  speed: `${speedMB} MB/s`,
                  eta: `${etaSeconds}s`,
                  videoId,
                });
                lastTime = now;
                lastDownloaded = downloaded;
              }
            });

            videoStream.on('end', () => {
              if (ctx.isCancelled()) return;
              videoFile.end();
              ctx.cleanup();
              onProgress({ status: 'completed', progress: 100, speed: '0 MB/s', eta: '0s', videoId });
              resolve(finalVideoPath);
            });

            videoStream.on('error', (err) => {
              videoFile.end();
              reject(err);
            });
          } else {
            if (!bestAudio) throw new Error('No audio streams found for merging');

            const videoSize = parseInt(videoFormat.contentLength || 0, 10);
            const audioSize = parseInt(bestAudio.contentLength || 0, 10);
            const totalSize = videoSize + audioSize;

            const tempVideoPath = path.join(downloadsDir, `temp_${videoId}_video.mp4`);
            const tempAudioPath = path.join(downloadsDir, `temp_${videoId}_audio.webm`);
            const finalVideoPath = path.join(downloadsDir, `${videoId}_${quality}.mp4`);

            cleanUpOnFailure = () => {
              [tempVideoPath, tempAudioPath, finalVideoPath].forEach((p) => {
                if (fs.existsSync(p)) fs.unlinkSync(p);
              });
            };

            onProgress({
              status: 'downloading',
              progress: partialBytes > 0
                ? Math.min(Math.round((partialBytes / (totalSize || 1)) * 90), 89)
                : 5,
              speed: '0 MB/s',
              eta: partialBytes > 0 ? 'Resuming streams...' : 'Downloading streams...',
            });

            const videoStream = ctx.trackStream(ytdl(url, { format: videoFormat, ...getYtdlOptions() }));
            const audioStream = ctx.trackStream(ytdl(url, { format: bestAudio, ...getYtdlOptions() }));
            const videoFile = fs.createWriteStream(tempVideoPath);
            const audioFile = fs.createWriteStream(tempAudioPath);

            videoStream.pipe(videoFile);
            audioStream.pipe(audioFile);

            let videoDownloaded = 0;
            let audioDownloaded = 0;
            let lastTime = Date.now();
            let lastTotalDownloaded = 0;

            const handleProgressUpdate = () => {
              const totalDownloaded = videoDownloaded + audioDownloaded;
              const now = Date.now();
              const duration = (now - lastTime) / 1000;
              if (duration >= 0.5) {
                const speedBytes = (totalDownloaded - lastTotalDownloaded) / duration;
                const speedMB = (speedBytes / (1024 * 1024)).toFixed(1);
                const remainingBytes = totalSize - totalDownloaded;
                const etaSeconds = speedBytes > 0 ? Math.ceil(remainingBytes / speedBytes) : 0;
                onProgress({
                  status: 'downloading',
                  progress: Math.min(Math.round((totalDownloaded / totalSize) * 90), 90),
                  speed: `${speedMB} MB/s`,
                  eta: `${etaSeconds}s`,
                  videoId,
                });
                lastTime = now;
                lastTotalDownloaded = totalDownloaded;
              }
            };

            videoStream.on('progress', (chunk, downloaded) => {
              if (ctx.isCancelled()) return;
              videoDownloaded = downloaded;
              handleProgressUpdate();
            });

            audioStream.on('progress', (chunk, downloaded) => {
              if (ctx.isCancelled()) return;
              audioDownloaded = downloaded;
              handleProgressUpdate();
            });

            let videoFinished = false;
            let audioFinished = false;
            let mergeStarted = false;

            const checkMerge = () => {
              if (!videoFinished || !audioFinished || mergeStarted || ctx.isCancelled()) return;
              mergeStarted = true;

              onProgress({ status: 'merging', progress: 92, speed: '0 MB/s', eta: 'Muxing audio and video...' });

              const ffmpegProcess = ctx.trackProcess(
                spawn(ffmpegPath, [
                  '-y',
                  '-i', tempVideoPath,
                  '-i', tempAudioPath,
                  '-c:v', 'copy',
                  '-c:a', 'aac',
                  '-movflags', 'faststart',
                  finalVideoPath,
                ])
              );

              ffmpegProcess.on('close', (code) => {
                if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
                if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
                ctx.cleanup();
                if (ctx.isCancelled()) return;
                if (code === 0) {
                  onProgress({ status: 'completed', progress: 100, speed: '0 MB/s', eta: '0s', videoId });
                  resolve(finalVideoPath);
                } else {
                  reject(new Error(`FFmpeg merge failed with code ${code}`));
                }
              });

              ffmpegProcess.on('error', reject);
            };

            videoStream.on('end', () => {
              videoFinished = true;
              videoFile.end();
              checkMerge();
            });

            audioStream.on('end', () => {
              audioFinished = true;
              audioFile.end();
              checkMerge();
            });

            videoStream.on('error', (err) => {
              videoFile.end();
              reject(err);
            });

            audioStream.on('error', (err) => {
              audioFile.end();
              reject(err);
            });
          }
        }
      } catch (err) {
        ctx.cancel();
        ctx.cleanup();
        cleanUpOnFailure();
        reject(err);
      }
    })();
  });
}

/**
 * Stream download directly to browser (no disk write for combined formats).
 */
async function streamVideoToResponse(videoId, quality, { startSeconds = 0, endSeconds = null } = {}) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const info = await ytdl.getInfo(url, getYtdlOptions());
  const isAudioOnly = quality === 'Audio Only' || quality === 'mp3';
  const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
  const bestAudio = selectBestAudio(audioFormats);
  const hasClip = startSeconds > 0 || (endSeconds !== null && endSeconds > startSeconds);

  const output = new PassThrough();

  if (isAudioOnly) {
    if (!bestAudio) throw new Error('No audio streams found');
    const audioStream = ytdl(url, { format: bestAudio, ...getYtdlOptions() });
    const args = ['-y', '-i', 'pipe:0', '-vn', '-c:a', 'libmp3lame', '-q:a', '2', '-f', 'mp3', 'pipe:1'];
    if (hasClip) {
      if (startSeconds > 0) args.unshift('-ss', String(startSeconds));
      if (endSeconds !== null) args.splice(args.indexOf('-i'), 0, '-to', String(endSeconds));
    }
    const ffmpegProcess = spawn(ffmpegPath, args);
    audioStream.pipe(ffmpegProcess.stdin);
    ffmpegProcess.stdout.pipe(output);
    ffmpegProcess.stderr.on('data', () => {});
    ffmpegProcess.on('error', (err) => output.destroy(err));
    ffmpegProcess.on('close', (code) => {
      if (code !== 0) output.destroy(new Error(`FFmpeg failed with code ${code}`));
    });
    audioStream.on('error', (err) => output.destroy(err));
    return { stream: output, contentType: 'audio/mpeg', ext: 'mp3' };
  }

  const videoFormat = selectVideoFormat(info, quality);
  if (!videoFormat) throw new Error(`No matching format for quality ${quality}`);

  if (videoFormat.hasAudio && !hasClip) {
    const videoStream = ytdl(url, { format: videoFormat, ...getYtdlOptions() });
    videoStream.pipe(output);
    videoStream.on('error', (err) => output.destroy(err));
    return { stream: output, contentType: 'video/mp4', ext: 'mp4' };
  }

  if (videoFormat.hasAudio && hasClip) {
    const videoStream = ytdl(url, { format: videoFormat, ...getYtdlOptions() });
    const args = ['-y', '-i', 'pipe:0', '-c', 'copy', '-movflags', 'faststart', '-f', 'mp4', 'pipe:1'];
    if (startSeconds > 0) args.splice(1, 0, '-ss', String(startSeconds));
    if (endSeconds !== null) args.splice(startSeconds > 0 ? 3 : 1, 0, '-to', String(endSeconds));
    const ffmpegProcess = spawn(ffmpegPath, args);
    videoStream.pipe(ffmpegProcess.stdin);
    ffmpegProcess.stdout.pipe(output);
    ffmpegProcess.on('error', (err) => output.destroy(err));
    videoStream.on('error', (err) => output.destroy(err));
    return { stream: output, contentType: 'video/mp4', ext: 'mp4' };
  }

  if (!bestAudio) throw new Error('No audio streams found for merging');

  const videoStream = ytdl(url, { format: videoFormat, ...getYtdlOptions() });
  const audioStream = ytdl(url, { format: bestAudio, ...getYtdlOptions() });

  const args = [
    '-y',
    '-i', 'pipe:0',
    '-i', 'pipe:3',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-movflags', 'faststart',
    '-f', 'mp4',
    'pipe:1',
  ];

  if (hasClip) {
    if (startSeconds > 0) args.splice(1, 0, '-ss', String(startSeconds));
    if (endSeconds !== null) args.splice(startSeconds > 0 ? 3 : 1, 0, '-to', String(endSeconds));
  }

  const ffmpegProcess = spawn(ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe', 'pipe'] });
  videoStream.pipe(ffmpegProcess.stdin);
  audioStream.pipe(ffmpegProcess.stdio[3]);
  ffmpegProcess.stdout.pipe(output);
  ffmpegProcess.on('error', (err) => output.destroy(err));
  videoStream.on('error', (err) => output.destroy(err));
  audioStream.on('error', (err) => output.destroy(err));

  return { stream: output, contentType: 'video/mp4', ext: 'mp4' };
}

module.exports = {
  getVideoInfo,
  downloadVideo,
  streamVideoToResponse,
  parseDurationToSeconds,
  getDurationString,
  formatBytes,
};
