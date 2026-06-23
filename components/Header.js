'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Settings, Zap, Cloud } from 'lucide-react';
import { GithubIcon as Github } from './BrandIcons';
import GoogleAuthBar from './GoogleAuthBar';

export default function Header({ onOpenSettings }) {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="flex items-center justify-between border-b-4 border-brand-black bg-white px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0 sticky top-0 z-40"
    >
      <div className="flex items-center gap-3">
        <motion.div
          whileHover={{ rotate: [-2, 2, -2, 0], scale: 1.05 }}
          transition={{ duration: 0.4 }}
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-brand-yellow border-4 border-brand-black flex items-center justify-center box-shadow-pixel-sm"
        >
          <span className="font-pixel text-[10px] sm:text-xs text-brand-black">PX</span>
        </motion.div>
        <div className="select-none">
          <span className="font-pixel text-sm sm:text-base text-brand-black tracking-tight">PIXFETCH</span>
          <p className="text-[10px] sm:text-xs font-bold text-neutral-500 -mt-0.5 hidden xs:block">
            YouTube Downloader
          </p>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-2">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex items-center gap-2 bg-brand-yellow/40 border-4 border-brand-black px-3 py-1.5 rounded-full text-xs font-bold"
        >
          <Zap className="w-3.5 h-3.5 fill-brand-black" />
          <span>Server Ready</span>
          <motion.span
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-2 h-2 bg-brand-black"
          />
        </motion.div>

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="hidden md:flex items-center gap-2 bg-blue-50 border-4 border-brand-black px-3 py-1.5 rounded-full text-xs font-bold"
        >
          <Cloud className="w-3.5 h-3.5 text-brand-black" />
          <span>Google Drive</span>
        </motion.div>
      </div>

      <div className="flex items-center gap-2">
        <GoogleAuthBar compact />
        <motion.a
          whileHover={{ scale: 1.08, y: -2 }}
          whileTap={{ scale: 0.95 }}
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="p-2.5 bg-white border-4 border-brand-black rounded-xl box-shadow-pixel-sm hover:box-shadow-pixel transition-shadow"
          title="GitHub"
        >
          <Github className="w-4 h-4 text-brand-black" />
        </motion.a>
        <motion.button
          whileHover={{ scale: 1.08, y: -2, rotate: 45 }}
          whileTap={{ scale: 0.95 }}
          onClick={onOpenSettings}
          className="p-2.5 bg-brand-yellow border-4 border-brand-black rounded-xl box-shadow-pixel-sm hover:box-shadow-pixel transition-shadow"
          title="Settings"
        >
          <Settings className="w-4 h-4 text-brand-black" />
        </motion.button>
      </div>
    </motion.header>
  );
}
