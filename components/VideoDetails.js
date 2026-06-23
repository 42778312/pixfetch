'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Music, Video, Scissors, Loader2 } from 'lucide-react';
import { cn } from '../lib/cn';

function parseTimeInput(value) {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  const parts = trimmed.split(':').map(Number);
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

function formatClipLength(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const STATUS_LABELS = {
  connecting: 'Connecting...',
  converting: 'Processing...',
  downloading: 'Downloading...',
  merging: 'Muxing...',
};

export default function VideoDetails({ data, onDownload, downloadState }) {
  const [selectedFormat, setSelectedFormat] = useState(data.formats[0]);
  const [clipEnabled, setClipEnabled] = useState(false);
  const [clipStart, setClipStart] = useState('');
  const [clipEnd, setClipEnd] = useState('');
  const [clipError, setClipError] = useState(null);

  const maxDuration = data.durationSeconds || 0;
  const isDownloading = downloadState != null;
  const progress = downloadState?.progress ?? 0;

  const handleDownload = () => {
    let clipOptions = {};

    if (clipEnabled) {
      const start = parseTimeInput(clipStart) ?? 0;
      const end = parseTimeInput(clipEnd);

      if (end === null || end <= start) {
        setClipError('Enter a valid end time after the start time (mm:ss or seconds).');
        return;
      }

      if (maxDuration && end > maxDuration) {
        setClipError(`End time cannot exceed video duration (${data.duration}).`);
        return;
      }

      setClipError(null);
      clipOptions = { start, end, forceServer: false };
    }

    onDownload(data.id, data.title, selectedFormat.quality, selectedFormat.size, data.thumbnail, clipOptions);
  };

  const clipLength =
    clipEnabled && parseTimeInput(clipEnd) != null && parseTimeInput(clipStart) != null
      ? formatClipLength(parseTimeInput(clipEnd) - (parseTimeInput(clipStart) ?? 0))
      : null;

  return (
    <motion.div
      layout
      className="bg-white border-4 border-brand-black rounded-2xl p-4 sm:p-6 box-shadow-pixel max-w-4xl mx-auto"
    >
      <div className="flex flex-col lg:flex-row gap-5 sm:gap-6">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="relative w-full lg:w-[280px] aspect-video rounded-xl overflow-hidden bg-neutral-100 border-4 border-brand-black flex-shrink-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.thumbnail}
            alt={data.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 right-2 bg-brand-black text-brand-yellow font-pixel text-[10px] px-2 py-1">
            {data.duration}
          </div>
        </motion.div>

        <div className="flex-1 flex flex-col justify-between min-w-0">
          <div>
            <p className="font-pixel text-[10px] text-neutral-500 mb-2 truncate">{data.author}</p>
            <h3 className="text-lg sm:text-xl font-bold text-brand-black leading-snug line-clamp-2 mb-4">
              {data.title}
            </h3>

            <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
              {data.formats.map((format, i) => {
                const isSelected = selectedFormat.quality === format.quality;
                const isAudio = format.quality === 'Audio Only' || format.ext === 'mp3';

                return (
                  <motion.button
                    key={format.quality}
                    type="button"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedFormat(format)}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-xl border-4 text-left transition-all',
                      isSelected
                        ? 'bg-brand-yellow border-brand-black box-shadow-pixel-sm'
                        : 'bg-white border-brand-black/30 hover:border-brand-black'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isAudio ? (
                        <Music className="w-4 h-4 flex-shrink-0" />
                      ) : (
                        <Video className="w-4 h-4 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{format.quality}</div>
                        <div className="text-[10px] uppercase font-bold text-neutral-500">{format.ext}</div>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold bg-white/80 border-2 border-brand-black px-1.5 py-0.5 rounded ml-1 flex-shrink-0">
                      {format.size}
                    </span>
                  </motion.button>
                );
              })}
            </div>

            <div className="mb-4 p-3 rounded-xl border-4 border-brand-black/20 bg-brand-yellow/10">
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={clipEnabled}
                  onChange={(e) => {
                    setClipEnabled(e.target.checked);
                    setClipError(null);
                  }}
                  className="w-4 h-4 accent-brand-yellow"
                />
                <Scissors className="w-4 h-4" />
                <span className="text-xs font-bold">Download clip only</span>
              </label>

              {clipEnabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="grid grid-cols-2 gap-2 mt-2"
                >
                  <div>
                    <label className="font-pixel text-[8px] text-neutral-500">START</label>
                    <input
                      type="text"
                      placeholder="0:00"
                      value={clipStart}
                      onChange={(e) => setClipStart(e.target.value)}
                      className="w-full mt-1 bg-white border-4 border-brand-black/30 rounded-lg px-2 py-2 text-xs font-bold focus:outline-none focus:border-brand-black"
                    />
                  </div>
                  <div>
                    <label className="font-pixel text-[8px] text-neutral-500">END</label>
                    <input
                      type="text"
                      placeholder="1:30"
                      value={clipEnd}
                      onChange={(e) => setClipEnd(e.target.value)}
                      className="w-full mt-1 bg-white border-4 border-brand-black/30 rounded-lg px-2 py-2 text-xs font-bold focus:outline-none focus:border-brand-black"
                    />
                  </div>
                </motion.div>
              )}

              {clipLength && <p className="text-[10px] font-bold text-neutral-500 mt-2">Clip: {clipLength}</p>}
              {clipError && <p className="text-[10px] text-red-600 font-bold mt-2">{clipError}</p>}
            </div>
          </div>

          <div className="space-y-2">
            {isDownloading && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span>{STATUS_LABELS[downloadState.status] || 'Working...'}</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-3 bg-neutral-100 border-2 border-brand-black rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ type: 'spring', stiffness: 100 }}
                    className="h-full bg-brand-yellow"
                  />
                </div>
              </div>
            )}

            <motion.button
              whileHover={!isDownloading ? { scale: 1.01, y: -2 } : {}}
              whileTap={!isDownloading ? { scale: 0.98 } : {}}
              onClick={handleDownload}
              disabled={isDownloading}
              className={cn(
                'w-full py-3.5 sm:py-4 rounded-xl font-bold flex items-center justify-center gap-2 border-4 transition-all',
                isDownloading
                  ? 'bg-neutral-100 border-brand-black/30 text-neutral-500 cursor-not-allowed'
                  : 'bg-brand-yellow border-brand-black text-brand-black box-shadow-pixel hover:box-shadow-pixel-lg'
              )}
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{STATUS_LABELS[downloadState.status] || 'Downloading...'}</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>
                    Download {clipEnabled ? 'clip' : ''} — {selectedFormat.quality} ({selectedFormat.size})
                  </span>
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
