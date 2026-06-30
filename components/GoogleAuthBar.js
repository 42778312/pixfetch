'use client';

import React, { useState } from 'react';
import { SignOutButton, useUser } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { LogOut, Loader2 } from 'lucide-react';
import { cn } from '../lib/cn';
import GoogleIcon from './GoogleIcon';
import GoogleSignInModal from './GoogleSignInModal';

export default function GoogleAuthBar({ compact = false }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const [modalOpen, setModalOpen] = useState(false);

  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-neutral-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        {!compact && <span className="text-xs font-bold">Checking...</span>}
      </div>
    );
  }

  if (isSignedIn && user) {
    const email = user.primaryEmailAddress?.emailAddress;
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
              {email}
            </span>
          )}
          <span className="text-[9px] font-pixel text-green-700 hidden sm:inline">DRIVE</span>
        </motion.div>
        <SignOutButton>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 bg-white border-2 border-brand-black rounded-lg hover:bg-neutral-50 transition-colors"
            title="Sign out of Google"
          >
            <LogOut className="w-3.5 h-3.5 text-brand-black" />
          </motion.button>
        </SignOutButton>
      </div>
    );
  }

  return (
    <>
      <motion.button
        type="button"
        whileHover={{ scale: 1.03, y: -1 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setModalOpen(true)}
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

      <GoogleSignInModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

export { default as GoogleIcon } from './GoogleIcon';
