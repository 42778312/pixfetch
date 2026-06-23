import { redirect } from 'next/navigation';
import { buildVideoDeepLink, isValidVideoId } from '@/lib/deepLink';

export default async function VideoShortPage({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const quality = typeof query.quality === 'string' ? query.quality : undefined;

  if (!isValidVideoId(id)) {
    redirect('/?error=invalid-video-id');
  }

  const target = buildVideoDeepLink(id, { quality, download: true });
  redirect(target);
}
