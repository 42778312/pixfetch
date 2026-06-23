import { isValidVideoId, isValidQuality } from '@/lib/constants';
import { sanitizeFilename } from '@/lib/constants';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('id');
    const quality = searchParams.get('quality') || '720p';
    const title = searchParams.get('title') || 'video';

    if (!videoId) {
      return Response.json({ error: 'Video ID is required' }, { status: 400 });
    }

    if (!isValidVideoId(videoId)) {
      return Response.json({ error: 'Invalid video ID' }, { status: 400 });
    }

    if (!isValidQuality(quality)) {
      return Response.json({ error: 'Invalid quality parameter' }, { status: 400 });
    }

    const isAudioOnly = quality === 'Audio Only';
    const ext = isAudioOnly ? 'mp3' : 'mp4';
    const filename = `${videoId}_${quality}.${ext}`;
    const downloadsDir = path.join(process.cwd(), 'downloads');
    const filePath = path.resolve(downloadsDir, filename);

    if (!filePath.startsWith(path.resolve(downloadsDir))) {
      return Response.json({ error: 'Invalid file path' }, { status: 400 });
    }

    if (!fs.existsSync(filePath)) {
      return Response.json({ error: 'Downloaded file not found. Please run the download again.' }, { status: 404 });
    }

    const cleanTitle = sanitizeFilename(title);
    const clientFilename = `${cleanTitle}.${ext}`;
    const fileStream = fs.createReadStream(filePath);
    const stat = fs.statSync(filePath);

    const headers = new Headers();
    headers.set(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(clientFilename)}"; filename*=UTF-8''${encodeURIComponent(clientFilename)}`
    );
    headers.set('Content-Type', isAudioOnly ? 'audio/mpeg' : 'video/mp4');
    headers.set('Content-Length', stat.size.toString());

    return new Response(fileStream, { headers });
  } catch (error) {
    return Response.json({ error: 'Server file transfer error: ' + error.message }, { status: 500 });
  }
}
