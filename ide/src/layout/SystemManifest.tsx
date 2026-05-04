/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { cn } from '../lib/utils';

const MANIFEST_ITEMS = [
  { label: 'Discovery Engine', status: 'Operational', color: 'text-emerald-500' },
  { label: 'Pipeline Cluster', status: 'Standby', color: 'text-amber-500' },
  { label: 'Agentic Browser', status: 'Active', color: 'text-emerald-500' },
  { label: 'Predictive API', status: 'Synced', color: 'text-emerald-500' },
] as const;

export const SystemManifest = () => (
  <div className="mt-auto pt-8 border-t border-[#1a1b1e]">
    <h5 className="text-[10px] font-mono text-[#4a4b50] uppercase tracking-widest mb-4 px-3">System Manifest</h5>
    <div className="space-y-3 px-3">
      {MANIFEST_ITEMS.map((item, i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[10px] font-mono">
            <span className="text-[#8E9299]">{item.label}</span>
            <span className={item.color}>{item.status}</span>
          </div>
          <div className="h-[2px] bg-[#1a1b1e] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ delay: i * 0.2 }}
              className={cn('h-full', item.color.replace('text', 'bg'))}
            />
          </div>
        </div>
      ))}
    </div>
  </div>
);
