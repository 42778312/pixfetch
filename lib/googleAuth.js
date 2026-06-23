import { getToken } from 'next-auth/jwt';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

async function fetchTokenScopes(accessToken) {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
    );
    if (!res.ok) return { scopes: null, error: `tokeninfo_${res.status}` };
    const data = await res.json();
    return { scopes: data.scope || '', expiresIn: data.expires_in, error: null };
  } catch {
    return { scopes: null, error: 'tokeninfo_fetch_failed' };
  }
}

function hasDriveFileScope(scopeString) {
  if (!scopeString) return false;
  return scopeString.includes('drive.file') || scopeString.includes(DRIVE_SCOPE);
}

/**
 * Get a valid Google access token from the encrypted session JWT (server-only).
 */
export async function getGoogleAccessToken(request) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token?.accessToken) {
    return null;
  }

  if (token.error === 'RefreshAccessTokenError') {
    return null;
  }

  const { scopes: liveScopes } = await fetchTokenScopes(token.accessToken);
  const jwtScopes = token.grantedScopes || '';
  const driveOk = hasDriveFileScope(liveScopes) || hasDriveFileScope(jwtScopes);

  if (!driveOk) {
    return { error: 'drive_scope_missing', reauthRequired: true };
  }

  return token.accessToken;
}

export { fetchTokenScopes, hasDriveFileScope, DRIVE_SCOPE };
