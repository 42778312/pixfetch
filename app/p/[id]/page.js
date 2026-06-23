import { redirect } from 'next/navigation';
import { buildPlaylistDeepLink } from '@/lib/deepLink';

const PLAYLIST_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export default async function PlaylistShortPage({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const quality = typeof query.quality === 'string' ? query.quality : undefined;

  if (!id || !PLAYLIST_ID_PATTERN.test(id)) {
    redirect('/?error=invalid-playlist-id');
  }

  const target = buildPlaylistDeepLink(id, { quality, download: true });
  redirect(target);
}
