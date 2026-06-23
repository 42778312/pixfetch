'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '../components/Header';
import BackgroundGraphics from '../components/BackgroundGraphics';
import URLInput from '../components/URLInput';
import VideoDetails from '../components/VideoDetails';
import PlaylistDetails from '../components/PlaylistDetails';
import DownloadQueue from '../components/DownloadQueue';
import SettingsPanel from '../components/SettingsPanel';
import { Zap, ArrowRight } from 'lucide-react';
import { loadSettings, saveSettings, createDownloadManager } from '../lib/downloadManager';
import {
  fetchDownloadStatus,
  downloadUrlWithProgress,
  readWithProgress,
  triggerBlobDownload,
  sanitizeDownloadFilename,
  getResumeKey,
  loadPartialDownload,
  savePartialDownload,
  clearPartialDownload,
  parseSizeToBytes,
} from '../lib/clientDownload';

const ACTIVE_STATUSES = ['connecting', 'converting', 'downloading', 'merging'];

function HomeContent() {
  const searchParams = useSearchParams();
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [ambiguous, setAmbiguous] = useState(null);
  const [queue, setQueue] = useState([]);
  const [downloadingIds, setDownloadingIds] = useState([]);
  const [settings, setSettings] = useState(loadSettings);
  const [showSettings, setShowSettings] = useState(false);

  const eventSourcesRef = useRef({});
  const downloadManagerRef = useRef(null);
  const deepLinkHandled = useRef(false);
  const settingsRef = useRef(settings);
  const startServerDownloadRef = useRef(null);
  const startStreamDownloadRef = useRef(null);
  settingsRef.current = settings;

  const ensureDownloadManager = () => {
    if (!downloadManagerRef.current) {
      downloadManagerRef.current = createDownloadManager({
        concurrency: settingsRef.current.concurrency,
        onStart: (job, onDone) => {
          if (job.useStream) {
            startStreamDownloadRef.current?.(job, onDone);
          } else {
            startServerDownloadRef.current?.(job, onDone);
          }
        },
      });
    }
    return downloadManagerRef.current;
  };

  useEffect(() => {
    return () => {
      Object.values(eventSourcesRef.current).forEach((es) => es.close());
    };
  }, []);

  useEffect(() => {
    if (deepLinkHandled.current) return;
    const deepUrl = searchParams.get('url');
    if (deepUrl) {
      deepLinkHandled.current = true;
      setUrl(deepUrl);
      handleAnalyze(deepUrl, true);
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const updateSettings = (next) => {
    setSettings(next);
    saveSettings(next);
  };

  const handleClear = () => {
    setUrl('');
    setError(null);
    setMetadata(null);
    setAmbiguous(null);
  };

  const handleAnalyze = async (customUrl = null, fromDeepLink = false) => {
    const urlToFetch = customUrl || url;
    if (!urlToFetch.trim()) return;

    setIsLoading(true);
    setError(null);
    setMetadata(null);
    setAmbiguous(null);

    try {
      const response = await fetch(`/api/info?url=${encodeURIComponent(urlToFetch)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch details');
      }

      if (data.type === 'ambiguous') {
        setAmbiguous(data);
        if (!fromDeepLink) setUrl(urlToFetch);
        return;
      }

      setMetadata(data);
      if (!fromDeepLink) setUrl(urlToFetch);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred. Please check your link.');
    } finally {
      setIsLoading(false);
    }
  };

  const resolveAmbiguous = async (mode) => {
    if (!ambiguous) return;
    const targetUrl = mode === 'video' ? ambiguous.videoUrl : ambiguous.playlistUrl;
    setUrl(targetUrl);
    setAmbiguous(null);
    setIsLoading(true);
    setError(null);
    setMetadata(null);

    try {
      const response = await fetch(
        `/api/info?url=${encodeURIComponent(targetUrl)}&mode=${mode}`
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch details');
      setMetadata(data);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const triggerPreset = (presetUrl) => {
    setUrl(presetUrl);
    handleAnalyze(presetUrl);
  };

  const finishDownloadTask = useCallback((taskId, videoId) => {
    setDownloadingIds((prev) => prev.filter((id) => id !== taskId));
    if (eventSourcesRef.current[taskId]) {
      delete eventSourcesRef.current[taskId];
    }
  }, []);

  const updateQueueItem = useCallback((taskId, patch) => {
    setQueue((prev) => prev.map((q) => (q.id === taskId ? { ...q, ...patch } : q)));
  }, []);

  const startServerDownload = useCallback(
    (item, onDone) => {
      const taskId = item.id;
      const { videoId, title, quality } = item;

      try {
        const es = new EventSource(
          `/api/download?id=${encodeURIComponent(videoId)}&quality=${encodeURIComponent(quality)}&taskId=${encodeURIComponent(taskId)}`
        );
        eventSourcesRef.current[taskId] = es;

        es.onmessage = (event) => {
          let data;
          try {
            data = JSON.parse(event.data);
          } catch {
            return;
          }

          updateQueueItem(taskId, {
            status: data.status,
            progress: data.progress,
            speed: data.speed,
            eta: data.eta,
            errorMessage: data.status === 'error' ? data.eta : undefined,
          });

          if (data.status === 'error') {
            es.close();
            finishDownloadTask(taskId, taskId);
            onDone();
            return;
          }

          if (data.status === 'completed') {
            es.close();
            finishDownloadTask(taskId, taskId);
            clearPartialDownload(getResumeKey(videoId, quality));

            if (settings.autoDownload) {
              const downloadUrl = `/api/download/file?id=${encodeURIComponent(videoId)}&quality=${encodeURIComponent(quality)}&title=${encodeURIComponent(title)}`;
              const a = document.createElement('a');
              a.href = downloadUrl;
              a.download = '';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }

            onDone();
          }
        };

        es.onerror = () => {
          updateQueueItem(taskId, {
            status: 'error',
            progress: 0,
            eta: 'Connection lost',
            speed: '0 MB/s',
          });
          es.close();
          finishDownloadTask(taskId, taskId);
          onDone();
        };
      } catch {
        finishDownloadTask(taskId, taskId);
        onDone();
      }
    },
    [finishDownloadTask, settings.autoDownload, updateQueueItem]
  );
  startServerDownloadRef.current = startServerDownload;

  const saveFileToDevice = useCallback(
    async (taskId, videoId, title, quality, size, clipStart, clipEnd) => {
      const ext = quality === 'Audio Only' ? 'mp3' : 'mp4';
      const filename = sanitizeDownloadFilename(title, ext);
      const expectedBytes = parseSizeToBytes(size);
      const resumeKey = getResumeKey(videoId, quality);
      let lastReceived = 0;
      let lastTime = Date.now();

      const onByteProgress = ({ received, totalBytes, progress }) => {
        const now = Date.now();
        const elapsed = (now - lastTime) / 1000;
        let speed = '0 MB/s';
        let eta = 'Saving...';
        if (elapsed >= 0.5 && received > lastReceived) {
          const speedBytes = (received - lastReceived) / elapsed;
          speed = `${(speedBytes / (1024 * 1024)).toFixed(1)} MB/s`;
          const total = totalBytes || expectedBytes;
          if (total > 0 && speedBytes > 0) {
            eta = `${Math.ceil((total - received) / speedBytes)}s`;
          }
          lastReceived = received;
          lastTime = now;
        }
        updateQueueItem(taskId, {
          status: 'downloading',
          progress,
          speed,
          eta,
        });
      };

      const fileUrl = `/api/download/file?id=${encodeURIComponent(videoId)}&quality=${encodeURIComponent(quality)}&title=${encodeURIComponent(title)}`;
      const blob = await downloadUrlWithProgress(fileUrl, { onProgress: onByteProgress, expectedBytes });
      triggerBlobDownload(blob, filename);
      await clearPartialDownload(resumeKey);
      updateQueueItem(taskId, { status: 'completed', progress: 100, eta: 'Done', speed: '0 MB/s' });
    },
    [updateQueueItem]
  );

  const startStreamDownload = useCallback(
    async (item, onDone) => {
      const taskId = item.id;
      const { videoId, title, quality, size, clipStart, clipEnd } = item;
      let handedOffToServer = false;
      const resumeKey = getResumeKey(videoId, quality);
      const expectedBytes = parseSizeToBytes(size);
      let lastReceived = 0;
      let lastTime = Date.now();

      try {
        const serverStatus = await fetchDownloadStatus(videoId, quality, size);
        const localPartial = await loadPartialDownload(resumeKey);

        if (serverStatus.status === 'complete') {
          updateQueueItem(taskId, {
            status: 'downloading',
            progress: serverStatus.progress || 100,
            eta: 'Resuming saved file...',
          });
          await saveFileToDevice(taskId, videoId, title, quality, size, clipStart, clipEnd);
          return;
        }

        if (serverStatus.status === 'partial') {
          handedOffToServer = true;
          updateQueueItem(taskId, {
            status: 'connecting',
            progress: serverStatus.progress || 0,
            eta: 'Resuming server download...',
            useStream: false,
          });
          startServerDownloadRef.current?.({ ...item, useStream: false }, onDone);
          return;
        }

        const initialProgress = localPartial?.progress || 0;
        updateQueueItem(taskId, {
          status: 'downloading',
          progress: Math.max(initialProgress, 2),
          eta: initialProgress > 0 ? 'Resuming stream...' : 'Streaming...',
        });

        let streamUrl = `/api/download/stream?id=${encodeURIComponent(videoId)}&quality=${encodeURIComponent(quality)}&title=${encodeURIComponent(title)}`;
        if (clipStart != null) streamUrl += `&start=${clipStart}`;
        if (clipEnd != null) streamUrl += `&end=${clipEnd}`;

        const response = await fetch(streamUrl);
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Stream download failed');
        }

        const onByteProgress = async ({ received, totalBytes, progress }) => {
          const now = Date.now();
          const elapsed = (now - lastTime) / 1000;
          let speed = '0 MB/s';
          let eta = 'Receiving...';
          if (elapsed >= 0.5 && received > lastReceived) {
            const speedBytes = (received - lastReceived) / elapsed;
            speed = `${(speedBytes / (1024 * 1024)).toFixed(1)} MB/s`;
            const total = totalBytes || expectedBytes;
            if (total > 0 && speedBytes > 0) {
              eta = `${Math.ceil((total - received) / speedBytes)}s`;
            }
            lastReceived = received;
            lastTime = now;
          }
          updateQueueItem(taskId, { status: 'downloading', progress, speed, eta });
          if (received % (512 * 1024) < 65536) {
            await savePartialDownload(resumeKey, { received, progress, updatedAt: Date.now() });
          }
        };

        const blob = await readWithProgress(response, { onProgress: onByteProgress, expectedBytes });
        const ext = quality === 'Audio Only' ? 'mp3' : 'mp4';
        triggerBlobDownload(blob, sanitizeDownloadFilename(title, ext));
        await clearPartialDownload(resumeKey);
        updateQueueItem(taskId, { status: 'completed', progress: 100, eta: 'Done', speed: '0 MB/s' });
      } catch (err) {
        if (startServerDownloadRef.current) {
          handedOffToServer = true;
          updateQueueItem(taskId, {
            status: 'connecting',
            progress: 0,
            eta: 'Retrying via server...',
            useStream: false,
          });
          startServerDownloadRef.current({ ...item, useStream: false }, onDone);
          return;
        }

        updateQueueItem(taskId, {
          status: 'error',
          progress: 0,
          eta: err.message || 'Failed',
          errorMessage: err.message,
        });
      } finally {
        if (!handedOffToServer) {
          finishDownloadTask(taskId, taskId);
          onDone();
        }
      }
    },
    [finishDownloadTask, updateQueueItem, saveFileToDevice]
  );
  startStreamDownloadRef.current = startStreamDownload;

  const handleDownload = useCallback(
    async (id, title, quality, size, thumbnail, clipOptions = {}) => {
      const taskId = `${id}-${quality}-${Date.now()}`;
      const hasClip = clipOptions.start != null || clipOptions.end != null;
      const useStream = (settings.useFastStream || hasClip) && !clipOptions.forceServer;

      const serverStatus = await fetchDownloadStatus(id, quality, size).catch(() => ({ status: 'none', progress: 0 }));
      const resumeKey = getResumeKey(id, quality);
      const localPartial = await loadPartialDownload(resumeKey).catch(() => null);
      const resumeProgress = serverStatus.progress || localPartial?.progress || 0;

      const newItem = {
        id: taskId,
        videoId: id,
        title,
        quality,
        size,
        thumbnail,
        progress: resumeProgress,
        speed: '0 MB/s',
        eta:
          serverStatus.status === 'complete'
            ? 'Ready to save...'
            : serverStatus.status === 'partial' || resumeProgress > 0
              ? 'Resuming...'
              : useStream
                ? 'Preparing stream...'
                : 'Connecting...',
        status: serverStatus.status === 'complete' ? 'downloading' : 'connecting',
        clipStart: clipOptions.start ?? null,
        clipEnd: clipOptions.end ?? null,
        useStream: serverStatus.status === 'partial' ? false : useStream,
      };

      setQueue((prev) => [newItem, ...prev]);
      setDownloadingIds((prev) => [...prev, taskId]);
      ensureDownloadManager().enqueue([newItem]);
    },
    [settings.useFastStream]
  );

  const handleBatchDownload = useCallback(
    (videos, quality) => {
      const jobs = videos.map((video) => {
        const taskId = `${video.id}-${quality}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        return {
          id: taskId,
          videoId: video.id,
          title: video.title,
          quality,
          size: video.size,
          thumbnail: video.thumbnail,
          progress: 0,
          speed: '0 MB/s',
          eta: 'Queued...',
          status: 'connecting',
          clipStart: null,
          clipEnd: null,
          useStream: false,
        };
      });

      setQueue((prev) => [...jobs, ...prev]);
      setDownloadingIds((prev) => [...prev, ...jobs.map((j) => j.id)]);
      ensureDownloadManager().enqueue(jobs);
    },
    [startServerDownload]
  );

  const handleRemoveQueueItem = async (taskId) => {
    if (eventSourcesRef.current[taskId]) {
      eventSourcesRef.current[taskId].close();
      delete eventSourcesRef.current[taskId];
    }

    try {
      await fetch(`/api/download?taskId=${encodeURIComponent(taskId)}`, { method: 'DELETE' });
    } catch {
      // ignore
    }

    setQueue((prev) => prev.filter((q) => q.id !== taskId));
    setDownloadingIds((prev) => prev.filter((id) => id !== taskId));
  };

  const handleClearQueue = () => {
    Object.entries(eventSourcesRef.current).forEach(([taskId, es]) => {
      es.close();
      fetch(`/api/download?taskId=${encodeURIComponent(taskId)}`, { method: 'DELETE' }).catch(() => {});
    });
    eventSourcesRef.current = {};
    downloadManagerRef.current?.clear();
    setQueue([]);
    setDownloadingIds([]);
  };

  const getVideoDownloadState = useCallback(
    (videoId) => {
      const active = queue.find((q) => q.videoId === videoId && ACTIVE_STATUSES.includes(q.status));
      if (!active) return null;
      return { taskId: active.id, status: active.status, progress: active.progress, eta: active.eta };
    },
    [queue]
  );

  const playlistDownloadStates = useMemo(() => {
    const map = {};
    queue.forEach((q) => {
      if (ACTIVE_STATUSES.includes(q.status)) {
        map[q.videoId] = { status: q.status, progress: q.progress };
      }
    });
    return map;
  }, [queue]);

  return (
    <div className="min-h-screen flex flex-col bg-white overflow-x-hidden text-brand-black relative">
      <BackgroundGraphics />

      <Header onOpenSettings={() => setShowSettings(true)} />

      <main className="flex-1 flex flex-col lg:flex-row gap-4 sm:gap-6 p-4 sm:p-6 max-w-[1600px] mx-auto w-full">
        <div className="flex-1 flex flex-col gap-4 sm:gap-5 min-w-0">
          <URLInput
            value={url}
            onChange={setUrl}
            onClear={handleClear}
            onAnalyze={() => handleAnalyze()}
            isLoading={isLoading}
            error={error}
          />

          <div className="flex-1 min-h-0">
            <AnimatePresence mode="wait">
              {ambiguous ? (
                <motion.div
                  key="ambiguous"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col items-center justify-center text-center p-4 sm:p-6"
                >
                  <div className="max-w-md bg-white border-4 border-brand-black rounded-2xl p-6 sm:p-8 space-y-5 box-shadow-pixel">
                    <h2 className="font-pixel text-xs sm:text-sm leading-relaxed text-brand-black">
                      VIDEO + PLAYLIST DETECTED
                    </h2>
                    <p className="text-sm text-neutral-600 font-medium">
                      This link contains both a single video and a playlist. What would you like to download?
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <motion.button
                        whileHover={{ scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => resolveAmbiguous('video')}
                        className="bg-brand-yellow border-4 border-brand-black text-brand-black font-bold px-5 py-3 rounded-xl text-sm box-shadow-pixel-sm hover:box-shadow-pixel transition-shadow"
                      >
                        This video only
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => resolveAmbiguous('playlist')}
                        className="bg-white border-4 border-brand-black text-brand-black font-bold px-5 py-3 rounded-xl text-sm box-shadow-pixel-sm hover:box-shadow-pixel transition-shadow"
                      >
                        Full playlist
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ) : metadata ? (
                <motion.div
                  key={metadata.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                >
                  {metadata.type === 'video' ? (
                    <VideoDetails
                      data={metadata}
                      onDownload={handleDownload}
                      downloadState={getVideoDownloadState(metadata.id)}
                    />
                  ) : (
                    <PlaylistDetails
                      data={metadata}
                      onDownloadSelected={handleBatchDownload}
                      downloadStates={playlistDownloadStates}
                    />
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="hero"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center text-center px-4 py-8 sm:py-16"
                >
                  <div className="max-w-2xl mx-auto space-y-8">
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.1, type: 'spring' }}
                      className="inline-flex items-center gap-2 bg-brand-yellow border-4 border-brand-black px-4 py-2 rounded-full text-xs font-bold box-shadow-pixel-sm"
                    >
                      <Zap className="w-4 h-4 fill-brand-black" />
                      <span>INSTANT MP4 & MP3 — PLAYLISTS & CLIPS</span>
                    </motion.div>

                    <motion.h1
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="font-pixel text-lg sm:text-2xl md:text-3xl leading-relaxed sm:leading-loose text-brand-black text-shadow-pixel"
                    >
                      GRAB YOUTUBE
                      <br />
                      VIDEOS FAST
                    </motion.h1>

                    <motion.p
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="text-base sm:text-lg text-neutral-600 max-w-md mx-auto font-medium leading-relaxed"
                    >
                      Paste a link above to parse files, pick quality, or extract audio. Shorts, playlists, and clip trims supported.
                    </motion.p>

                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="pt-2"
                    >
                      <p className="font-pixel text-[10px] text-neutral-500 mb-4 tracking-wide">QUICK TEST</p>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                        <motion.button
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => triggerPreset('https://www.youtube.com/watch?v=dQw4w9WgXcQ')}
                          disabled={isLoading}
                          className="bg-white border-4 border-brand-black px-5 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 box-shadow-pixel-sm hover:box-shadow-pixel transition-shadow disabled:opacity-50"
                        >
                          <span className="w-3 h-3 bg-brand-yellow border-2 border-brand-black" />
                          Single Video
                          <ArrowRight className="w-4 h-4" />
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => triggerPreset('https://www.youtube.com/playlist?list=PL348EC907433B838C')}
                          disabled={isLoading}
                          className="bg-brand-yellow border-4 border-brand-black px-5 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 box-shadow-pixel-sm hover:box-shadow-pixel transition-shadow disabled:opacity-50"
                        >
                          <span className="w-3 h-3 bg-brand-black" />
                          Playlist
                          <ArrowRight className="w-4 h-4" />
                        </motion.button>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="w-full lg:w-[360px] xl:w-[400px] flex-shrink-0">
          <DownloadQueue
            queue={queue}
            onClearQueue={handleClearQueue}
            onRemoveItem={handleRemoveQueueItem}
            showSaveButton={!settings.autoDownload}
          />
        </div>
      </main>

      <footer className="text-center py-4 border-t-4 border-brand-black text-xs text-neutral-500 font-bold bg-brand-yellow/30 flex-shrink-0 select-none">
        &copy; {new Date().getFullYear()} PIXFETCH Studio — MIT License
      </footer>

      <AnimatePresence>
        {showSettings && (
          <SettingsPanel
            settings={settings}
            onChange={updateSettings}
            onClose={() => setShowSettings(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><div className="font-pixel text-sm animate-pulse">LOADING...</div></div>}>
      <HomeContent />
    </Suspense>
  );
}
