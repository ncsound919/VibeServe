/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';

interface SentimentMeterProps {
  score: number;
}

export const SentimentMeter = ({ score }: SentimentMeterProps) => (
  <div className="bg-[#151619] border border-[#2d2e32] p-6 rounded-xl flex flex-col items-center justify-center relative overflow-hidden group max-w-full">
    <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    <div className="relative w-32 h-32 flex items-center justify-center scale-90 sm:scale-100 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r="58" fill="none" stroke="#1a1b1e" strokeWidth="8" />
        <motion.circle
          cx="64"
          cy="64"
          r="58"
          fill="none"
          stroke={score > 0 ? '#10b981' : '#f43f5e'}
          strokeWidth="8"
          strokeDasharray={364}
          initial={{ strokeDashoffset: 364 }}
          animate={{ strokeDashoffset: 364 - Math.abs(score) * 364 }}
          className="drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{(score * 100).toFixed(0)}%</span>
        <span className="text-[10px] uppercase tracking-widest text-[#4a4b50] font-mono">
          {score > 0 ? 'Bullish' : 'Bearish'}
        </span>
      </div>
    </div>
    <div className="mt-4 w-full flex justify-between text-[10px] font-mono text-[#4a4b50] uppercase tracking-tighter">
      <span>Market Fear</span>
      <span>Greed Index</span>
    </div>
  </div>
);
