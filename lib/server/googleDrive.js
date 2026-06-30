const CHUNK_SIZE = 8 * 1024 * 1024;

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
    throw new Error(`Failed to start Drive upload: ${await res.text()}`);
  }

  const sessionUrl = res.headers.get('Location');
  if (!sessionUrl) throw new Error('Drive upload session URL missing');
  return sessionUrl;
}

async function putChunk(sessionUrl, chunk, startByte, isFinal, totalBytes) {
  const endByte = startByte + chunk.length - 1;
  const contentRange = isFinal
    ? `bytes ${startByte}-${endByte}/${totalBytes}`
    : `bytes ${startByte}-${endByte}/*`;

  const res = await fetch(sessionUrl, {
    method: 'PUT',
    headers: {
      'Content-Length': String(chunk.length),
      'Content-Range': contentRange,
    },
    body: chunk,
  });

  if (res.status === 308) return { done: false };
  if (!res.ok) {
    throw new Error(`Drive upload failed (${res.status}): ${await res.text()}`);
  }

  return { done: true, data: await res.json() };
}

export async function uploadStreamResumable(sessionUrl, byteIter, { onProgress } = {}) {
  let offset = 0;
  let buffer = Buffer.alloc(0);

  for await (const value of byteIter) {
    if (value?.length) {
      buffer = Buffer.concat([buffer, value]);
    }

    while (buffer.length >= CHUNK_SIZE) {
      const chunk = buffer.subarray(0, CHUNK_SIZE);
      buffer = buffer.subarray(CHUNK_SIZE);
      const result = await putChunk(sessionUrl, chunk, offset, false, 0);
      if (result.done) return result.data;
      offset += chunk.length;
      onProgress?.({ uploaded: offset, total: 0 });
    }
  }

  const totalSize = offset + buffer.length;
  if (buffer.length === 0 && offset === 0) {
    throw new Error('Empty stream — nothing to upload');
  }

  if (buffer.length > 0) {
    const result = await putChunk(sessionUrl, buffer, offset, true, totalSize);
    onProgress?.({ uploaded: totalSize, total: totalSize });
    return result.data;
  }

  const res = await fetch(sessionUrl, {
    method: 'PUT',
    headers: {
      'Content-Length': '0',
      'Content-Range': `bytes */${offset}`,
    },
  });
  if (res.ok) return res.json();

  onProgress?.({ uploaded: offset, total: offset });
  return { id: null, webViewLink: 'https://drive.google.com/drive/my-drive' };
}
