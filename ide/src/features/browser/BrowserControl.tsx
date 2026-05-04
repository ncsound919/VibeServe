/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { Globe, Eye } from 'lucide-react';
import type { BrowserObservationData } from '../../types';

interface BrowserControlProps {
  snapshot: BrowserObservationData;
}

export const BrowserControl = ({ snapshot }: BrowserControlProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-[#0a0a0c] border border-[#2d2e32] rounded-xl overflow-hidden mt-8 shadow-2xl"
  >
    <div className="bg-[#151619] border-b border-[#2d2e32] px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-rose-500/50" />
          <div className="w-2 h-2 rounded-full bg-amber-500/50" />
          <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
        </div>
        <div className="bg-[#0a0a0c] border border-[#2d2e32] px-3 py-1 rounded-md text-[9px] font-mono text-[#4a4b50] flex items-center gap-2">
          <Globe size={10} />
          {snapshot.url}
        </div>
      </div>
      <div className="text-[9px] font-mono text-[#4a4b50]">
        VIEWPORT: {snapshot.viewport.w}x{snapshot.viewport.h} (AUTO_SCALED)
      </div>
    </div>

    <div className="p-6 bg-[#0a0a0c] min-h-[140px] flex flex-col justify-center items-center relative overflow-hidden">
      {/* Simulated Browser Grid */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#4a4b50 0.5px, transparent 0.5px)', backgroundSize: '10px 10px' }}
      />

      <div className="relative z-10 text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-mono text-emerald-400 animate-pulse">
          <Eye size={12} />
          AGENT_OBSERVATION: ACTIVE_SURVEILLANCE
        </div>
        <p className="text-xs text-[#8E9299] font-mono max-w-md mx-auto leading-relaxed">
          {snapshot.snapshotDescription}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {snapshot.elementsFound.map((el, i) => (
            <span
              key={i}
              className="text-[8px] font-mono bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded text-blue-400"
            >
              {el}
            </span>
          ))}
        </div>
      </div>
    </div>
  </motion.div>
);
