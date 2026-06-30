import { checkRateLimit } from '@/lib/server/rateLimit';
import { isFfmpegAvailable, isYtdlpAvailable } from '@/lib/server/ytdlp';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const limited = checkRateLimit('health', request);
  if (limited) return limited;

  const [ytdlpOk, ffmpegOk] = await Promise.all([isYtdlpAvailable(), isFfmpegAvailable()]);
  const healthy = ytdlpOk || ffmpegOk;

  return Response.json(
    {
      status: healthy ? 'ok' : 'degraded',
      ytdl: false,
      ytdlp: ytdlpOk,
      ffmpeg: ffmpegOk,
    },
    { status: healthy ? 200 : 503 }
  );
}
