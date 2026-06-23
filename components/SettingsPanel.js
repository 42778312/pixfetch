'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Settings2 } from 'lucide-react';
import { ALLOWED_QUALITIES } from '../lib/constants';
import { normalizeQuality } from '../lib/deepLink';

export default function SettingsPanel({ settings, onChange, onClose }) {
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const deepLinkQuality = normalizeQuality(settings.deepLinkQuality);

  const bookmarkletHref = useMemo(() => {
    if (!origin) return '#';
    const quality = encodeURIComponent(deepLinkQuality);
    return `javascript:(function(){window.open('${origin}/?url='+encodeURIComponent(location.href)+'&download=1&quality=${quality}','_blank')})()`;
  }, [origin, deepLinkQuality]);

  const quickLinks = useMemo(() => {
    if (!origin) return [];
    return [
      `${origin}/watch?v=VIDEO_ID`,
      `${origin}/v/VIDEO_ID`,
      `${origin}/p/PLAYLIST_ID`,
    ];
  }, [origin]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white border-4 border-brand-black rounded-2xl w-full max-w-md box-shadow-pixel-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b-4 border-brand-black">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-brand-black" />
            <h2 className="font-pixel text-xs text-brand-black">SETTINGS</h2>
          </div>
          <motion.button
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-1.5 rounded-lg border-2 border-brand-black hover:bg-brand-yellow transition-colors"
          >
            <X className="w-4 h-4" />
          </motion.button>
        </div>

        <div className="p-5 space-y-5">
          <label className="flex items-center justify-between gap-4 cursor-pointer p-3 rounded-xl border-4 border-brand-black/20 hover:border-brand-black transition-colors">
            <div>
              <p className="text-sm font-bold text-brand-black">Fast stream download</p>
              <p className="text-xs text-neutral-500 mt-0.5 font-medium">Pipe video directly to browser</p>
            </div>
            <input
              type="checkbox"
              checked={settings.useFastStream}
              onChange={(e) => onChange({ ...settings, useFastStream: e.target.checked })}
              className="w-5 h-5 accent-brand-yellow"
            />
          </label>

          <label className="flex items-center justify-between gap-4 cursor-pointer p-3 rounded-xl border-4 border-brand-black/20 hover:border-brand-black transition-colors">
            <div>
              <p className="text-sm font-bold text-brand-black">Auto-save when complete</p>
              <p className="text-xs text-neutral-500 mt-0.5 font-medium">Save file after server download</p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoDownload}
              onChange={(e) => onChange({ ...settings, autoDownload: e.target.checked })}
              className="w-5 h-5 accent-brand-yellow"
            />
          </label>

          <div className="p-3 rounded-xl border-4 border-brand-black/20">
            <label className="text-sm font-bold text-brand-black">Playlist concurrency</label>
            <p className="text-xs text-neutral-500 mt-0.5 mb-2 font-medium">Max simultaneous batch downloads</p>
            <select
              value={settings.concurrency}
              onChange={(e) => onChange({ ...settings, concurrency: parseInt(e.target.value, 10) })}
              className="w-full bg-white border-4 border-brand-black rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none"
            >
              <option value={1}>1 at a time</option>
              <option value={2}>2 at a time</option>
              <option value={3}>3 at a time</option>
            </select>
          </div>

          <div className="p-3 rounded-xl border-4 border-brand-black/20">
            <label className="text-sm font-bold text-brand-black">Quick link quality</label>
            <p className="text-xs text-neutral-500 mt-0.5 mb-2 font-medium">
              Default quality for bookmarklet and /watch links
            </p>
            <select
              value={deepLinkQuality}
              onChange={(e) => onChange({ ...settings, deepLinkQuality: e.target.value })}
              className="w-full bg-white border-4 border-brand-black rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none"
            >
              {ALLOWED_QUALITIES.map((quality) => (
                <option key={quality} value={quality}>
                  {quality}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 border-t-4 border-brand-black/20">
            <p className="font-pixel text-[9px] text-neutral-500 mb-2">BOOKMARKLET</p>
            <p className="text-[11px] text-neutral-500 mb-3 font-medium">
              Drag to bookmarks bar. Click on any YouTube page to download here at {deepLinkQuality}.
            </p>
            <a
              href={bookmarkletHref}
              className="inline-block text-xs font-bold text-brand-black bg-brand-yellow border-4 border-brand-black px-4 py-2.5 rounded-xl box-shadow-pixel-sm hover:box-shadow-pixel transition-shadow"
              onClick={(e) => e.preventDefault()}
            >
              Download on PIXFETCH
            </a>
          </div>

          <div className="pt-2 border-t-4 border-brand-black/20">
            <p className="font-pixel text-[9px] text-neutral-500 mb-2">QUICK LINKS</p>
            <p className="text-[11px] text-neutral-500 mb-3 font-medium">
              Swap youtube.com for your site host in the address bar, or use these patterns:
            </p>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link}>
                  <code className="block text-[10px] font-mono bg-neutral-100 border-2 border-brand-black/20 rounded-lg px-2 py-1.5 break-all select-all">
                    {link}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
