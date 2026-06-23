import { redirect } from 'next/navigation';
import { buildWatchDeepLink, isValidVideoId } from '@/lib/deepLink';

export default async function WatchPage({ searchParams }) {
  const params = await searchParams;
  const videoId = typeof params.v === 'string' ? params.v : null;
  const playlistId = typeof params.list === 'string' ? params.list : null;
  const quality = typeof params.quality === 'string' ? params.quality : undefined;
  const mode =
    params.mode === 'video' || params.mode === 'playlist' ? params.mode : null;

  if (!videoId && !playlistId) {
    redirect('/?error=missing-video-or-playlist');
  }

  if (videoId && !isValidVideoId(videoId)) {
    redirect('/?error=invalid-video-id');
  }

  const target = buildWatchDeepLink({
    videoId,
    playlistId,
    quality,
    download: true,
    mode,
  });

  if (!target) {
    redirect('/?error=invalid-link');
  }

  redirect(target);
}
