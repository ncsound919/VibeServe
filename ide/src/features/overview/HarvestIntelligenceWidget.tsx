/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Globe } from 'lucide-react';

interface HarvestIntelligenceWidgetProps {
  sources: { name: string; url: string; lastUpdate: string }[];
}

export const HarvestIntelligenceWidget = ({ sources }: HarvestIntelligenceWidgetProps) => (
  <div className="bg-[#151619] border border-[#2d2e32] rounded-xl p-4 mt-8">
    <div className="flex items-center gap-2 mb-3 text-[#4a4b50]">
      <Globe size={14} />
      <span className="text-[10px] font-mono uppercase tracking-[0.2em]">Live Intelligence Trace</span>
    </div>
    <div className="space-y-2">
      {sources.map((source, i) => (
        <div key={i} className="flex justify-between items-center text-[9px] font-mono">
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#8E9299] hover:text-white transition-colors"
          >
            {source.name}
          </a>
          <span className="text-[#4a4b50]">{new Date(source.lastUpdate).toLocaleTimeString()}</span>
        </div>
      ))}
    </div>
  </div>
);
