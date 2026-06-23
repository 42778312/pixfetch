'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDownCircle, Video, Music, Download, Trash2, Zap, CheckCircle2, Cloud, ExternalLink } from 'lucide-react';
import { cn } from '../lib/cn';

const ACTIVE_STATUSES = ['connecting', 'converting', 'downloading', 'merging'];

export default function DownloadQueue({ queue, onClearQueue, onRemoveItem, showSaveButton = true }) {
  const activeDownloads = queue.filter((item) => ACTIVE_STATUSES.includes(item.status));

  const getStatusStyle = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-600';
      case 'downloading':
        return 'bg-brand-yellow text-brand-black border-brand-black';
      case 'merging':
        return 'bg-purple-100 text-purple-800 border-purple-500';
      case 'connecting':
      case 'converting':
        return 'bg-orange-100 text-orange-800 border-orange-500';
      case 'error':
        return 'bg-red-100 text-red-700 border-red-500';
      default:
        return 'bg-neutral-100 text-neutral-600 border-neutral-300';
    }
  };

  const getStatusLabel = (status, progress = 0, destination) => {
    switch (status) {
      case 'completed':
        return destination === 'google-drive' ? 'On Drive!' : 'Done!';
      case 'downloading':
        return destination === 'google-drive' ? 'Uploading' : 'Downloading';
      case 'merging':
        return 'Muxing';
      case 'connecting':
        return progress > 0 ? 'Resuming' : 'Connecting';
      case 'converting':
        return 'Analyzing';
      case 'error':
        return 'Failed';
      default:
        return 'Queued';
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-white border-4 border-brand-black rounded-2xl p-4 sm:p-5 box-shadow-pixel flex flex-col max-h-[500px] lg:max-h-[calc(100vh-200px)] lg:sticky lg:top-24"
    >
      <div className="flex items-center justify-between border-b-4 border-brand-black pb-3 mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <ArrowDownCircle className="w-5 h-5 text-brand-black" />
          <h3 className="font-pixel text-[10px] sm:text-xs text-brand-black">QUEUE</h3>
          <AnimatePresence>
            {activeDownloads.length > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="font-pixel text-[8px] bg-brand-yellow border-2 border-brand-black px-2 py-0.5"
              >
                {activeDownloads.length} LIVE
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {queue.length > 0 && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClearQueue}
            className="font-pixel text-[8px] text-neutral-500 hover:text-brand-black flex items-center gap-1 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            CLEAR
          </motion.button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-[120px]">
        {queue.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full flex flex-col items-center justify-center text-center text-neutral-400 py-8"
          >
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
              <ArrowDownCircle className="w-12 h-12 text-neutral-200 mb-3 mx-auto" />
            </motion.div>
            <p className="font-pixel text-[10px] text-neutral-500 mb-2">EMPTY</p>
            <p className="text-xs font-medium max-w-[200px]">
              Paste a URL above to start downloading
            </p>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            {queue.map((item) => {
              const isAudio = item.quality === 'Audio Only' || item.quality === 'mp3';
              const isActive = ACTIVE_STATUSES.includes(item.status);

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, x: 20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -20, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="bg-brand-yellow/10 border-4 border-brand-black/20 rounded-xl p-3 relative group hover:border-brand-black transition-colors"
                >
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onRemoveItem(item.id)}
                    className="absolute top-2 right-2 p-1.5 bg-white border-2 border-brand-black text-neutral-500 hover:text-brand-black rounded-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    title="Remove"
                  >
                    <Trash2 className="w-3 h-3" />
                  </motion.button>

                  <div className="flex items-start gap-3">
                    <div className="relative w-16 sm:w-20 aspect-video rounded-lg overflow-hidden bg-neutral-100 border-2 border-brand-black flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                      <div className="absolute top-1 left-1 p-0.5 bg-brand-black rounded">
                        {isAudio ? (
                          <Music className="w-2.5 h-2.5 text-brand-yellow" />
                        ) : (
                          <Video className="w-2.5 h-2.5 text-brand-yellow" />
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 pr-6">
                      <h4 className="text-xs sm:text-sm font-bold text-brand-black truncate leading-snug">
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        {item.destination === 'google-drive' && (
                          <Cloud className="w-3 h-3 text-blue-600 flex-shrink-0" />
                        )}
                        <span className="text-[9px] font-bold text-neutral-500">{item.size}</span>
                        <span className="w-1 h-1 bg-brand-black" />
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-white border-2 border-brand-black rounded">
                          {item.quality}
                        </span>
                      </div>
                      {item.status === 'error' && item.errorMessage && (
                        <p className="text-[10px] text-red-600 font-bold mt-1 line-clamp-2">{item.errorMessage}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] font-bold mb-1.5 gap-2">
                      <span
                        className={cn(
                          'px-2 py-0.5 border-2 font-pixel text-[8px] flex items-center gap-1',
                          getStatusStyle(item.status)
                        )}
                      >
                        {item.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                        {getStatusLabel(item.status, item.progress, item.destination)}
                      </span>

                      {(item.status === 'downloading' || item.status === 'connecting') && item.progress > 0 && (
                        <div className="flex items-center gap-1.5 text-[9px] bg-white border-2 border-brand-black px-2 py-0.5 rounded">
                          <Zap className="w-2.5 h-2.5 fill-brand-yellow" />
                          <span>{item.speed}</span>
                          <span className="text-neutral-400">|</span>
                          <span>{item.eta}</span>
                        </div>
                      )}

                      {item.status === 'completed' && item.webViewLink ? (
                        <motion.a
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          href={item.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 bg-blue-50 border-2 border-brand-black font-bold px-2.5 py-1 rounded-lg text-[9px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" />
                          Open in Drive
                        </motion.a>
                      ) : item.status === 'completed' && showSaveButton ? (
                        <motion.a
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          href={`/api/download/file?id=${item.videoId}&quality=${encodeURIComponent(item.quality)}&title=${encodeURIComponent(item.title)}`}
                          download
                          className="flex items-center gap-1 bg-brand-yellow border-2 border-brand-black font-bold px-2.5 py-1 rounded-lg text-[9px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download className="w-3 h-3" />
                          Save
                        </motion.a>
                      ) : isActive ? (
                        <span className="font-pixel text-[10px]">{item.progress}%</span>
                      ) : null}
                    </div>

                    <div className="w-full h-2.5 bg-neutral-100 border-2 border-brand-black rounded-full overflow-hidden relative">
                      {isActive && item.progress === 0 && (
                        <motion.div
                          className="absolute inset-y-0 left-0 w-1/3 bg-brand-yellow rounded-full"
                          animate={{ x: ['-100%', '350%'] }}
                          transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                        />
                      )}
                      <motion.div
                        initial={false}
                        animate={{ width: `${item.progress}%` }}
                        transition={{ type: 'spring', stiffness: 120, damping: 22 }}
                        className={cn(
                          'h-full rounded-full relative z-[1]',
                          item.status === 'completed'
                            ? 'bg-green-500'
                            : item.status === 'error'
                              ? 'bg-red-500'
                              : item.status === 'merging'
                                ? 'bg-purple-500'
                                : 'bg-brand-yellow',
                          isActive && item.progress > 0 && item.progress < 100 && 'animate-pulse'
                        )}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}
