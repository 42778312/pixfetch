'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Download, List, CheckSquare, Square, Search, Loader2 } from 'lucide-react';
import { cn } from '../lib/cn';

export default function PlaylistDetails({ data, onDownloadSelected, downloadStates = {} }) {
  const [selectedIds, setSelectedIds] = useState(() => data.videos.map((v) => v.id));
  const [filterQuery, setFilterQuery] = useState('');
  const [downloadFormat, setDownloadFormat] = useState('720p');

  const filteredVideos = useMemo(() => {
    return data.videos.filter((video) => video.title.toLowerCase().includes(filterQuery.toLowerCase()));
  }, [data.videos, filterQuery]);

  const visibleSelectedCount = filteredVideos.filter((v) => selectedIds.includes(v.id)).length;

  const toggleSelectVideo = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    const filteredIds = filteredVideos.map((v) => v.id);
    const allFilteredSelected = filteredIds.every((id) => selectedIds.includes(id));

    if (allFilteredSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...filteredIds])]);
    }
  };

  const handleDownloadBatch = () => {
    const selectedVideos = data.videos.filter((v) => selectedIds.includes(v.id));
    onDownloadSelected(selectedVideos, downloadFormat);
  };

  const allFilteredSelected =
    filteredVideos.length > 0 && filteredVideos.every((v) => selectedIds.includes(v.id));

  return (
    <motion.div
      layout
      className="bg-white border-4 border-brand-black rounded-2xl p-4 sm:p-5 box-shadow-pixel max-w-4xl mx-auto flex flex-col max-h-[70vh]"
    >
      <div className="flex flex-col sm:flex-row gap-4 border-b-4 border-brand-black pb-4 mb-4 flex-shrink-0">
        <div className="relative w-full sm:w-[160px] aspect-video sm:h-[90px] rounded-xl overflow-hidden border-4 border-brand-black bg-neutral-100 flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.thumbnail} alt={data.title} className="w-full h-full object-cover" />
          <div className="absolute inset-y-0 right-0 w-1/3 bg-brand-black/90 flex flex-col items-center justify-center border-l-4 border-brand-black">
            <List className="w-5 h-5 text-brand-yellow mb-1" />
            <span className="font-pixel text-[10px] text-brand-yellow">{data.videosCount}</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-between min-w-0">
          <div>
            <p className="font-pixel text-[10px] text-neutral-500 mb-1">PLAYLIST</p>
            <h3 className="text-base sm:text-lg font-bold text-brand-black line-clamp-1">{data.title}</h3>
            <p className="text-xs text-neutral-500 font-bold mt-0.5">by {data.author}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-3 sm:mt-0">
            <div className="flex bg-brand-yellow/20 p-0.5 rounded-lg border-4 border-brand-black text-xs font-bold">
              {['1080p', '720p', '480p', 'Audio Only'].map((fmt) => (
                <motion.button
                  key={fmt}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setDownloadFormat(fmt)}
                  className={cn(
                    'px-2.5 sm:px-3 py-1.5 rounded-md transition-colors',
                    downloadFormat === fmt
                      ? 'bg-brand-yellow border-2 border-brand-black'
                      : 'text-neutral-600 hover:text-brand-black'
                  )}
                >
                  {fmt === 'Audio Only' ? 'MP3' : fmt}
                </motion.button>
              ))}
            </div>

            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleDownloadBatch}
              disabled={selectedIds.length === 0}
              className="bg-brand-yellow border-4 border-brand-black disabled:opacity-40 text-brand-black text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 box-shadow-pixel-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Get {selectedIds.length} videos</span>
            </motion.button>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 mb-3 flex-shrink-0">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={toggleSelectAll}
          className="flex items-center gap-1.5 text-xs font-bold text-brand-black bg-brand-yellow/20 border-4 border-brand-black px-3 py-2 rounded-xl"
        >
          {allFilteredSelected ? (
            <CheckSquare className="w-4 h-4" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          <span>{allFilteredSelected ? 'Deselect all' : `Select all (${filteredVideos.length})`}</span>
        </motion.button>

        {filterQuery && (
          <span className="text-[10px] text-neutral-500 font-bold">{visibleSelectedCount} in view</span>
        )}

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search playlist..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full bg-white border-4 border-brand-black/30 rounded-xl pl-9 pr-4 py-2 text-xs font-medium focus:outline-none focus:border-brand-black transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-1.5">
        {filteredVideos.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-neutral-400 py-10">
            <Search className="w-8 h-8 text-neutral-200 mb-2" />
            <p className="text-sm font-bold">No matches found</p>
          </div>
        ) : (
          filteredVideos.map((video, idx) => {
            const isSelected = selectedIds.includes(video.id);
            const dlState = downloadStates[video.id];

            return (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(idx * 0.02, 0.5) }}
                onClick={() => toggleSelectVideo(video.id)}
                className={cn(
                  'flex items-center justify-between p-2.5 rounded-xl border-4 transition-all cursor-pointer select-none',
                  isSelected
                    ? 'bg-brand-yellow/30 border-brand-black'
                    : 'bg-white border-brand-black/15 hover:border-brand-black/40'
                )}
              >
                <div className="flex items-center gap-2 sm:gap-3 overflow-hidden min-w-0">
                  <div
                    className="flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectVideo(video.id);
                    }}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-brand-black" />
                    ) : (
                      <Square className="w-4 h-4 text-neutral-400" />
                    )}
                  </div>

                  <span className="font-pixel text-[9px] text-neutral-400 w-5 flex-shrink-0 text-right">
                    {idx + 1}
                  </span>

                  <div className="relative w-14 sm:w-16 aspect-video rounded-lg overflow-hidden bg-neutral-100 border-2 border-brand-black flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                  </div>

                  <span className="text-xs sm:text-sm font-bold text-brand-black truncate pr-2">
                    {video.title}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 pl-2">
                  <span className="text-[10px] font-bold text-neutral-500 hidden sm:inline">
                    {video.duration}
                  </span>

                  {dlState ? (
                    <div className="flex items-center gap-1">
                      <Loader2 className="w-4 h-4 animate-spin text-brand-black" />
                      <span className="font-pixel text-[8px]">{dlState.progress}%</span>
                    </div>
                  ) : (
                    <span className="text-[10px] bg-white border-2 border-brand-black text-neutral-600 font-bold px-2 py-0.5 rounded">
                      {video.size}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
