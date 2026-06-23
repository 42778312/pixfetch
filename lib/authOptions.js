import GoogleProvider from 'next-auth/providers/google';

async function refreshGoogleAccessToken(token) {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Token refresh failed');

    return {
      ...token,
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      refreshToken: data.refresh_token ?? token.refreshToken,
    };
  } catch {
    return { ...token, error: 'RefreshAccessTokenError' };
  }
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/drive.file',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/',
    error: '/',
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at ? account.expires_at * 1000 : Date.now() + 3600 * 1000,
          grantedScopes: account.scope || '',
        };
      }

      if (token.expiresAt && Date.now() < token.expiresAt - 60_000) {
        return token;
      }

      if (token.refreshToken) {
        return refreshGoogleAccessToken(token);
      }

      return token;
    },
    async session({ session, token }) {
      if (token?.error) {
        session.error = token.error;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
