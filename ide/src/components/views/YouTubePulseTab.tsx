/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Zap } from 'lucide-react';
import { SectionHeader } from '../components/SectionHeader';
import { YouTubePulse } from '../features/youtube/YouTubePulse';
import type { VideoItem } from '../types';

interface YouTubePulseTabProps {
  videos: VideoItem[];
}

export const YouTubePulseTab = ({ videos }: YouTubePulseTabProps) => (
  <div className="space-y-8">
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <SectionHeader title="Nexus Video Scan" icon={Zap} />
        <p className="text-[10px] font-mono text-[#4a4b50] pl-6 uppercase tracking-wider">
          Scanned from YouTube RSS · Polled every 8h · {videos.length} videos
        </p>
      </div>
      <div className="flex items-center gap-2 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-[9px] font-mono text-emerald-400">
        <Zap size={10} />
        DEEPSEEK CURATED
      </div>
    </div>
    <YouTubePulse videos={videos} />
  </div>
);
