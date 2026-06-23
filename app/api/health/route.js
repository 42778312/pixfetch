import { checkRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const limited = checkRateLimit('health', request);
  if (limited) return limited;

  let ytdlOk = false;
  let ytdlpOk = false;

  try {
    const ytdl = require('@distube/ytdl-core');
    ytdlOk = await ytdl.validateURL('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  } catch {
    ytdlOk = false;
  }

  try {
    const { isYtDlpAvailable } = require('@/lib/ytdlp');
    ytdlpOk = await isYtDlpAvailable();
  } catch {
    ytdlpOk = false;
  }

  const healthy = ytdlOk || ytdlpOk;

  return Response.json(
    {
      status: healthy ? 'ok' : 'degraded',
      ytdl: ytdlOk,
      ytdlp: ytdlpOk,
    },
    { status: healthy ? 200 : 503 }
  );
}
