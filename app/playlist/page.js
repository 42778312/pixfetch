import { redirect } from 'next/navigation';
import { buildPlaylistDeepLink } from '@/lib/deepLink';

const PLAYLIST_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export default async function PlaylistPage({ searchParams }) {
  const params = await searchParams;
  const playlistId = typeof params.list === 'string' ? params.list : null;
  const quality = typeof params.quality === 'string' ? params.quality : undefined;

  if (!playlistId || !PLAYLIST_ID_PATTERN.test(playlistId)) {
    redirect('/?error=invalid-playlist-id');
  }

  const target = buildPlaylistDeepLink(playlistId, { quality, download: true });
  redirect(target);
}
