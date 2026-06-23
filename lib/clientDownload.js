'use client';

const DB_NAME = 'ytdl-resume';
const STORE_NAME = 'partials';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

export function getResumeKey(videoId, quality) {
  return `${videoId}:${quality}`;
}

export async function loadPartialDownload(key) {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function savePartialDownload(key, data) {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(data, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore storage errors
  }
}

export async function clearPartialDownload(key) {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore
  }
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

export async function fetchDownloadStatus(videoId, quality, size) {
  const params = new URLSearchParams({ id: videoId, quality });
  if (size) params.set('size', size);
  const res = await fetch(`/api/download/status?${params}`);
  if (!res.ok) return { status: 'none', progress: 0 };
  return res.json();
}

/**
 * Read a response body (or fetch URL) with byte progress callbacks.
 */
export async function readWithProgress(response, { onProgress, expectedBytes = 0, signal }) {
  const totalBytes = parseInt(response.headers.get('Content-Length') || '0', 10) || expectedBytes;
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  let lastUpdate = 0;

  while (true) {
    if (signal?.aborted) {
      reader.cancel();
      break;
    }

    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;

    const now = Date.now();
    if (now - lastUpdate >= 200) {
      const progress = totalBytes > 0 ? Math.min(Math.round((received / totalBytes) * 98), 98) : Math.min(received > 0 ? 50 : 5, 98);
      onProgress?.({ received, totalBytes, progress });
      lastUpdate = now;
    }
  }

  const blob = new Blob(chunks);
  const progress = 100;
  onProgress?.({ received: blob.size, totalBytes: blob.size || totalBytes, progress });
  return blob;
}

export async function downloadUrlWithProgress(url, { onProgress, expectedBytes = 0, signal }) {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Download failed');
  }
  return readWithProgress(response, { onProgress, expectedBytes, signal });
}

export function triggerBlobDownload(blob, filename) {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

export function sanitizeDownloadFilename(title, ext) {
  return `${title.replace(/[\\/*?:"<>|]/g, '').trim() || 'video'}.${ext}`;
}

export { parseSizeToBytes };
