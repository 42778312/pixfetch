const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB

async function putChunk(sessionUrl, chunk, startByte, isFinal, totalBytes) {
  const endByte = startByte + chunk.byteLength - 1;
  const contentRange = isFinal
    ? `bytes ${startByte}-${endByte}/${totalBytes}`
    : `bytes ${startByte}-${endByte}/*`;

  const res = await fetch(sessionUrl, {
    method: 'PUT',
    headers: {
      'Content-Length': String(chunk.byteLength),
      'Content-Range': contentRange,
    },
    body: chunk,
  });

  if (res.status === 308) {
    return { done: false };
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive upload failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return { done: true, data };
}

function concatBuffers(a, b) {
  if (a.length === 0) return b;
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/**
 * Upload a Node.js readable stream to Google Drive via resumable upload.
 */
export async function uploadStreamResumable(sessionUrl, nodeStream, { onProgress } = {}) {
  const { Readable } = await import('stream');
  const webStream = Readable.toWeb(nodeStream);
  const reader = webStream.getReader();

  let offset = 0;
  let buffer = new Uint8Array(0);

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (value?.byteLength) {
        buffer = concatBuffers(buffer, value);
      }

      while (buffer.length >= CHUNK_SIZE) {
        const chunk = buffer.slice(0, CHUNK_SIZE);
        buffer = buffer.slice(CHUNK_SIZE);
        const result = await putChunk(sessionUrl, chunk, offset, false);
        if (result.done) return result.data;
        offset += chunk.length;
        onProgress?.({ uploaded: offset, total: 0 });
      }

      if (done) {
        const totalSize = offset + buffer.length;
        if (buffer.length === 0 && offset === 0) {
          throw new Error('Empty stream — nothing to upload');
        }
        if (buffer.length > 0) {
          const result = await putChunk(sessionUrl, buffer, offset, true, totalSize);
          onProgress?.({ uploaded: totalSize, total: totalSize });
          return result.data;
        }
        // Ended exactly on chunk boundary — query status / finalize
        const res = await fetch(sessionUrl, {
          method: 'PUT',
          headers: {
            'Content-Length': '0',
            'Content-Range': `bytes */${offset}`,
          },
        });
        if (res.ok) {
          return res.json();
        }
        onProgress?.({ uploaded: offset, total: offset });
        return { id: null, webViewLink: `https://drive.google.com/drive/my-drive` };
      }
    }
  } finally {
    reader.releaseLock?.();
  }
}

/**
 * Start a Google Drive resumable upload session.
 */
export async function createResumableSession(accessToken, filename, mimeType) {
  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({ name: filename, mimeType }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to start Drive upload: ${err}`);
  }

  const sessionUrl = res.headers.get('Location');
  if (!sessionUrl) {
    throw new Error('Drive upload session URL missing');
  }

  return sessionUrl;
}
