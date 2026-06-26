'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const SessionContext = createContext({
  data: null,
  status: 'loading',
  refresh: async () => {},
});

export function SessionProvider({ children }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');

  const refresh = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' });
      const json = await res.json();
      if (json?.user) {
        setData(json);
        setStatus('authenticated');
      } else {
        setData(null);
        setStatus('unauthenticated');
      }
    } catch {
      setData(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <SessionContext.Provider value={{ data, status, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}

export async function signIn() {
  window.location.href = '/api/auth/google';
}

export async function signOut() {
  await fetch('/api/auth/signout', { method: 'POST', credentials: 'include' });
}
