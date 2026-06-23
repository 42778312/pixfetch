'use client';

const DEFAULT_SETTINGS = {
  autoDownload: true,
  useFastStream: true,
  concurrency: 2,
  deepLinkQuality: '720p',
};

export function loadSettings() {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem('ytdl-settings');
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('ytdl-settings', JSON.stringify(settings));
}

export function createDownloadManager({ concurrency, onStart }) {
  const pending = [];
  let active = 0;

  const pump = () => {
    while (active < concurrency && pending.length > 0) {
      const job = pending.shift();
      active += 1;
      onStart(job, () => {
        active -= 1;
        pump();
      });
    }
  };

  return {
    enqueue(jobs) {
      pending.push(...jobs);
      pump();
    },
    clear() {
      pending.length = 0;
    },
    get pendingCount() {
      return pending.length;
    },
    get activeCount() {
      return active;
    },
  };
}
