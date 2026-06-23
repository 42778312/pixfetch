'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function BackgroundGraphics() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none select-none">
      <motion.div
        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-20 -left-20 w-[400px] h-[400px] rounded-full bg-brand-yellow/20 blur-3xl"
      />
      <motion.div
        animate={{ x: [0, -25, 0], y: [0, 25, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -bottom-32 -right-20 w-[500px] h-[500px] rounded-full bg-brand-yellow/15 blur-3xl"
      />

      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--brand-black)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--brand-black)) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />

      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          animate={{
            y: [0, -15, 0],
            opacity: [0.15, 0.35, 0.15],
          }}
          transition={{
            duration: 3 + i * 0.5,
            repeat: Infinity,
            delay: i * 0.4,
          }}
          className="absolute w-3 h-3 bg-brand-yellow border-2 border-brand-black"
          style={{
            left: `${10 + i * 15}%`,
            top: `${20 + (i % 3) * 25}%`,
          }}
        />
      ))}
    </div>
  );
}
