'use client';

import { useUser } from '@clerk/nextjs';

/** Clerk-backed session shape for components that expect the old session API. */
export function useSession() {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) {
    return { data: null, status: 'loading' };
  }

  if (!isSignedIn || !user) {
    return { data: null, status: 'unauthenticated' };
  }

  return {
    data: {
      user: {
        name: user.fullName,
        email: user.primaryEmailAddress?.emailAddress,
        image: user.imageUrl,
      },
    },
    status: 'authenticated',
  };
}
