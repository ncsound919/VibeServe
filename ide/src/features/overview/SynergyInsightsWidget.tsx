/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { Zap, Github } from 'lucide-react';

interface SynergyInsightsWidgetProps {
  insights: string[];
}

export const SynergyInsightsWidget = ({ insights }: SynergyInsightsWidgetProps) => (
  <div className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-500/20 rounded-xl p-6 relative overflow-hidden">
    <div className="absolute top-0 right-0 p-4 opacity-10">
      <Github size={120} className="text-blue-400 rotate-12" />
    </div>
    <div className="flex items-center gap-2 mb-4">
      <Zap size={18} className="text-blue-400" />
      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Synergy Discovery Engine</h3>
    </div>
    <div className="space-y-4 relative z-10">
      {insights.map((insight, i) => (
        <motion.div
          key={i}
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: i * 0.1 }}
          className="flex gap-3 items-start group"
        >
          <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 group-hover:scale-150 transition-transform shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
          <p className="text-xs text-[#8E9299] leading-relaxed group-hover:text-blue-100 transition-colors">
            {insight}
          </p>
        </motion.div>
      ))}
    </div>
  </div>
);
