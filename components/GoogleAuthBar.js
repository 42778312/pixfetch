'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { LogOut, Loader2 } from 'lucide-react';
import { cn } from '../lib/cn';
import { signIn, signOut, useSession } from '../lib/session';

function GoogleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function GoogleAuthBar({ compact = false }) {
  const { data: session, status, refresh } = useSession();
  const isLoading = status === 'loading';

  const handleSignOut = async () => {
    await signOut();
    await refresh();
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-neutral-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        {!compact && <span className="text-xs font-bold">Checking...</span>}
      </div>
    );
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            'flex items-center gap-2 bg-green-50 border-2 border-green-600 rounded-xl',
            compact ? 'px-2 py-1' : 'px-3 py-1.5'
          )}
        >
          <GoogleIcon className="w-4 h-4 flex-shrink-0" />
          {!compact && (
            <span className="text-[10px] sm:text-xs font-bold text-green-800 max-w-[120px] sm:max-w-[160px] truncate">
              {session.user.email}
            </span>
          )}
          <span className="text-[9px] font-pixel text-green-700 hidden sm:inline">DRIVE</span>
        </motion.div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSignOut}
          className="p-2 bg-white border-2 border-brand-black rounded-lg hover:bg-neutral-50 transition-colors"
          title="Sign out of Google"
        >
          <LogOut className="w-3.5 h-3.5 text-brand-black" />
        </motion.button>
      </div>
    );
  }

  return (
    <motion.button
      whileHover={{ scale: 1.03, y: -1 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => signIn()}
      className={cn(
        'flex items-center gap-2 bg-white border-4 border-brand-black rounded-xl font-bold text-brand-black box-shadow-pixel-sm hover:box-shadow-pixel transition-shadow',
        compact ? 'px-2.5 py-1.5 text-[10px]' : 'px-3 sm:px-4 py-2 text-xs sm:text-sm'
      )}
    >
      <GoogleIcon className="w-4 h-4 flex-shrink-0" />
      <span className="whitespace-nowrap">
        {compact ? 'Google' : 'Sign in with Google'}
      </span>
    </motion.button>
  );
}

export { GoogleIcon };
