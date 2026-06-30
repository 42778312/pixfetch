import { auth, clerkClient } from '@clerk/nextjs/server';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GOOGLE_PROVIDER = 'oauth_google';

export async function getGoogleDriveAccessToken() {
  const { userId } = await auth();
  if (!userId) return null;

  const client = await clerkClient();
  const response = await client.users.getUserOauthAccessToken(userId, GOOGLE_PROVIDER);
  const token = response.data?.[0]?.token;
  if (!token) {
    return { reauthRequired: true, error: 'drive_scope_missing' };
  }

  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`
    );
    if (res.ok) {
      const data = await res.json();
      const scopes = data.scope || '';
      if (!scopes.includes('drive.file') && !scopes.includes(DRIVE_SCOPE)) {
        return { reauthRequired: true, error: 'drive_scope_missing' };
      }
    }
  } catch {
    // If tokeninfo fails, still attempt upload with Clerk-managed token.
  }

  return token;
}
