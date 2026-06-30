'use client';

import { useEffect, useState } from 'react';
import { useSignIn } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, Loader2, X } from 'lucide-react';
import GoogleIcon from './GoogleIcon';

export default function GoogleSignInModal({ open, onClose }) {
  const { signIn, isLoaded } = useSignIn();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleGoogleSignIn = async () => {
    if (!isLoaded || !signIn) return;
    setLoading(true);
    setError(null);
    try {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: returnTo || '/',
      });
    } catch (err) {
      setError(err?.message || 'Could not start Google sign-in. Try again.');
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.button
            type="button"
            aria-label="Close"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-brand-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="google-signin-title"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="relative w-full max-w-sm bg-[#FFFEF5] border-4 border-brand-black rounded-2xl box-shadow-pixel overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-2 bg-brand-yellow border-b-4 border-brand-black" />

            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg border-2 border-brand-black bg-white hover:bg-neutral-50 transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4 text-brand-black" />
            </button>

            <div className="px-6 pt-8 pb-6 text-center">
              <div className="mx-auto mb-4 w-14 h-14 rounded-xl bg-brand-yellow border-4 border-brand-black flex items-center justify-center box-shadow-pixel-sm">
                <Cloud className="w-7 h-7 text-brand-black" />
              </div>

              <h2
                id="google-signin-title"
                className="font-pixel text-sm text-brand-black tracking-tight mb-2"
              >
                CONNECT DRIVE
              </h2>
              <p className="text-sm font-bold text-neutral-600 mb-6 leading-relaxed">
                Sign in with Google to save downloads straight to your Drive.
              </p>

              <motion.button
                type="button"
                whileHover={{ scale: loading ? 1 : 1.02, y: loading ? 0 : -1 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                disabled={loading || !isLoaded}
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-3 bg-white border-4 border-brand-black rounded-xl px-4 py-3.5 font-bold text-brand-black box-shadow-pixel-sm hover:box-shadow-pixel transition-shadow disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <GoogleIcon className="w-5 h-5 flex-shrink-0" />
                )}
                <span>{loading ? 'Redirecting...' : 'Continue with Google'}</span>
              </motion.button>

              {error && (
                <p className="mt-4 text-xs font-bold text-red-600 bg-red-50 border-2 border-red-300 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <p className="mt-5 text-[10px] font-bold text-neutral-400 leading-relaxed">
                Only files PIXFETCH uploads are accessible — we never browse your Drive.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
