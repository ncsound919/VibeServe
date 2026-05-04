/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { NewsItem } from '../../types';

interface NewsCardProps {
  item: NewsItem;
}

export const NewsCard = ({ item }: NewsCardProps) => (
  <div className="group border-b border-[#2d2e32] py-5 last:border-0 hover:bg-emerald-500/[0.02] transition-all px-3 -mx-3 rounded-lg">
    <div className="flex justify-between items-center mb-2">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'w-1 h-3 rounded-full',
            item.sentiment === 'positive' ? 'bg-emerald-500' :
            item.sentiment === 'negative' ? 'bg-rose-500' : 'bg-[#4a4b50]',
          )}
        />
        <span className="text-[10px] font-mono text-[#4a4b50] uppercase tracking-tighter">{item.source}</span>
      </div>
      <span className="text-[9px] font-mono text-[#3a3b3f] uppercase">{item.timestamp}</span>
    </div>
    <h4 className="text-sm text-[#e2e8f0] font-medium leading-snug group-hover:text-emerald-400 transition-colors cursor-pointer pr-4 relative">
      {item.title}
      <ChevronRight
        size={14}
        className="absolute right-0 top-0.5 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0"
      />
    </h4>
    <p className="text-[11px] text-[#8E9299] mt-2 line-clamp-2 leading-relaxed opacity-70 group-hover:opacity-100 transition-opacity">
      {item.summary}
    </p>
  </div>
);
