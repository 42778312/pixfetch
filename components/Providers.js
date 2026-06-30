'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { clerkAppearance } from '@/lib/clerkAppearance';

export default function Providers({ children }) {
  return <ClerkProvider appearance={clerkAppearance}>{children}</ClerkProvider>;
}
