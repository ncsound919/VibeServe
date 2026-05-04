/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { Zap, Play, Sparkles, TrendingUp } from 'lucide-react';
import type { VideoItem } from '../../types';

interface YouTubePulseProps {
  videos: VideoItem[];
}

export const YouTubePulse = ({ videos }: YouTubePulseProps) => {
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [showCount, setShowCount] = useState(12);
  const [hovered, setHovered] = useState<number | null>(null);

  const getEmbedUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      let id = '';
      if (urlObj.hostname === 'youtu.be') {
        id = urlObj.pathname.slice(1);
      } else {
        id = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop() || '';
      }
      return `https://www.youtube.com/embed/${id}?autoplay=1`;
    } catch {
      return url;
    }
  };

  if (!videos || videos.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-[#151619] border border-[#2d2e32] rounded-xl">
        <p className="text-[#4a4b50] font-mono text-sm">No videos available</p>
      </div>
    );
  }

  const displayed = videos.slice(0, showCount);
  const topView = Math.max(...displayed.map(v => parseInt(v.views) || 0));

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayed.map((video, i) => {
          const views = parseInt(video.views) || 0;
          const isTrending = views >= topView * 0.7;
          return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -6, scale: 1.02 }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            className="relative bg-[#151619] border border-[#2d2e32] rounded-xl overflow-hidden group hover:border-emerald-500/40 transition-all duration-300 cursor-pointer"
            style={hovered === i ? {
              boxShadow: '0 0 30px rgba(16,185,129,0.15), 0 0 60px rgba(16,185,129,0.05), inset 0 0 30px rgba(16,185,129,0.03)'
            } : {}}
          >
            {isTrending && (
              <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 bg-amber-500/90 rounded-full text-[9px] font-mono text-black font-bold">
                <TrendingUp size={10} /> TRENDING
              </div>
            )}
            <div className="aspect-video bg-[#0a0a0c] relative overflow-hidden">
              {playingId === i ? (
                <iframe
                  src={getEmbedUrl(video.url)}
                  title={video.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/10 via-transparent to-transparent" />
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <button
                    onClick={() => setPlayingId(i)}
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/30 cursor-pointer"
                  >
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      className="w-14 h-14 rounded-full flex items-center justify-center bg-emerald-500/20 border border-emerald-500/40 backdrop-blur-sm shadow-xl shadow-emerald-500/20"
                    >
                      <Play size={22} fill="white" className="text-white ml-0.5" />
                    </motion.div>
                  </button>
                  <motion.div
                    animate={isTrending ? { opacity: [0.5, 1, 0.5] } : {}}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-emerald-500/90 backdrop-blur-sm rounded text-[9px] font-mono uppercase text-black font-bold flex items-center gap-1"
                  >
                    <Sparkles size={9} /> AI CURATED
                  </motion.div>
                </>
              )}
            </div>
            <div className="p-3 relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-12 h-1 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent rounded-full" />
              <h4 className="text-sm font-medium text-white mb-2 line-clamp-2 leading-snug group-hover:text-emerald-200 transition-colors">{video.title}</h4>
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-mono text-[#4a4b50] truncate max-w-[55%]">{video.channel}</span>
                <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-1">
                  <Zap size={9} className="text-emerald-500/50" />
                  {video.views} Views
                </span>
              </div>
            </div>
          </motion.div>
        )})}
      </div>
      {videos.length > showCount && (
        <div className="flex justify-center mt-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCount((c) => c + 12)}
            className="relative px-6 py-2 text-[10px] font-mono uppercase tracking-widest text-emerald-400 border border-emerald-400/30 rounded-lg hover:bg-emerald-400/10 transition-all overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            Load More ({videos.length - showCount} remaining)
          </motion.button>
        </div>
      )}
    </div>
  );
};
