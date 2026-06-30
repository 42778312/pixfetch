import fs from 'fs';
import { isValidQuality, isValidVideoId, sanitizeFilename } from '@/lib/constants';
import { getDownloadsDir, getFinalPath } from '@/lib/server/storage';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const quality = searchParams.get('quality') || '720p';
  const title = searchParams.get('title') || 'video';

  if (!isValidVideoId(id)) {
    return Response.json({ error: 'Invalid video ID' }, { status: 400 });
  }
  if (!isValidQuality(quality)) {
    return Response.json({ error: 'Invalid quality parameter' }, { status: 400 });
  }

  const filePath = getFinalPath(id, quality);
  const resolved = filePath;
  const downloadsRoot = getDownloadsDir();

  if (!resolved.startsWith(downloadsRoot)) {
    return Response.json({ error: 'Invalid file path' }, { status: 400 });
  }

  if (!fs.existsSync(resolved)) {
    return Response.json(
      { error: 'Downloaded file not found. Please run the download again.' },
      { status: 404 }
    );
  }

  const isAudio = quality === 'Audio Only';
  const ext = isAudio ? 'mp3' : 'mp4';
  const cleanTitle = sanitizeFilename(title);
  const clientFilename = `${cleanTitle}.${ext}`;
  const encoded = encodeURIComponent(clientFilename);
  const fileBuffer = fs.readFileSync(resolved);

  return new Response(fileBuffer, {
    headers: {
      'Content-Type': isAudio ? 'audio/mpeg' : 'video/mp4',
      'Content-Disposition': `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`,
    },
  });
}
