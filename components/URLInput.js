'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clipboard, X, Loader2, ArrowRight } from 'lucide-react';
import { YoutubeIcon as Youtube } from './BrandIcons';
import { getValidationHint } from '../lib/urlParser';

export default function URLInput({ value, onChange, onAnalyze, isLoading, error, onClear }) {
  const [canPaste, setCanPaste] = useState(false);
  const [focused, setFocused] = useState(false);

  const validationHint = useMemo(() => getValidationHint(value), [value]);

  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.clipboard?.readText) {
      setCanPaste(true);
    }
  }, []);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) onChange(text);
    } catch (err) {
      console.warn('Clipboard read failed: ', err);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim()) onAnalyze();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="w-full"
    >
      <form onSubmit={handleSubmit} className="relative">
        <motion.div
          animate={{
            boxShadow: focused
              ? '6px 6px 0 hsl(var(--brand-black))'
              : '4px 4px 0 hsl(var(--brand-black))',
          }}
          className="relative flex flex-col sm:flex-row items-stretch sm:items-center bg-white border-4 border-brand-black rounded-2xl overflow-hidden transition-shadow"
        >
          <div className="flex items-center flex-1 px-4 py-3 sm:py-4 gap-3">
            <motion.div animate={{ scale: focused ? 1.15 : 1 }} transition={{ type: 'spring' }}>
              <Youtube className="w-6 h-6 sm:w-7 sm:h-7 text-brand-black flex-shrink-0" />
            </motion.div>

            <input
              type="text"
              placeholder="Paste YouTube URL here..."
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              disabled={isLoading}
              className="flex-1 bg-transparent border-none outline-none text-brand-black placeholder-neutral-400 text-base sm:text-lg font-medium focus:ring-0 w-full min-w-0"
              autoComplete="off"
              spellCheck="false"
            />
          </div>

          <div className="flex items-center gap-1.5 px-3 pb-3 sm:pb-0 sm:pr-3 border-t-4 sm:border-t-0 sm:border-l-4 border-brand-black bg-brand-yellow/20 sm:bg-transparent">
            {value && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={onClear}
                disabled={isLoading}
                className="p-2.5 hover:bg-brand-yellow/50 rounded-lg text-brand-black transition-colors"
                title="Clear"
              >
                <X className="w-4 h-4" />
              </motion.button>
            )}

            {canPaste && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={handlePaste}
                disabled={isLoading}
                className="p-2.5 hover:bg-brand-yellow/50 rounded-lg text-brand-black transition-colors flex items-center gap-1"
                title="Paste"
              >
                <Clipboard className="w-4 h-4" />
                <span className="text-xs font-bold hidden sm:inline">Paste</span>
              </motion.button>
            )}

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={isLoading || !value.trim()}
              className="bg-brand-yellow border-4 border-brand-black text-brand-black px-4 sm:px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 box-shadow-pixel-sm disabled:opacity-40 disabled:cursor-not-allowed ml-auto sm:ml-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Analyzing</span>
                </>
              ) : (
                <>
                  <span>Analyze</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </form>

      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="w-full h-2 bg-neutral-100 border-2 border-brand-black rounded-full overflow-hidden mt-3"
          >
            <motion.div
              animate={{ x: ['-100%', '200%'] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
              className="h-full w-1/3 bg-brand-yellow"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {validationHint && !error && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-3 text-sm flex items-center justify-center gap-2 bg-brand-yellow/30 border-4 border-brand-black px-4 py-3 rounded-xl font-medium"
          >
            <span>{validationHint}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="mt-3 text-sm flex items-center justify-center gap-2 bg-red-50 border-4 border-red-500 text-red-700 px-4 py-3 rounded-xl font-bold"
          >
            <span className="w-2 h-2 bg-red-500 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
