/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  trend?: string;
}

export const StatCard = ({ title, value, unit, icon: Icon, trend }: StatCardProps) => {
  const [hovered, setHovered] = useState(false);
  return (
  <motion.div
    data-testid="stat-card"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    onMouseEnter={() => setHovered(true)}
    onMouseLeave={() => setHovered(false)}
    className="relative bg-[#151619] border border-[#2d2e32] p-6 rounded-xl overflow-hidden group hover:border-emerald-500/40 transition-all duration-300"
    style={hovered ? {
      boxShadow: '0 0 25px rgba(16,185,129,0.1), inset 0 0 25px rgba(16,185,129,0.02)'
    } : {}}
  >
    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
      <Icon size={48} />
    </div>
    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-16 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent group-hover:via-emerald-500/80 transition-all" />
    <p data-testid="stat-title" className="text-[#8E9299] text-xs font-mono uppercase tracking-widest mb-1">{title}</p>
    <div className="flex items-baseline gap-2">
      <h3 data-testid="stat-value" className="text-3xl font-medium text-white group-hover:text-emerald-200 transition-colors">{value}</h3>
      {unit && <span className="text-[#8E9299] text-sm font-mono">{unit}</span>}
    </div>
    {trend && (
      <div className="mt-2 flex items-center gap-1 text-emerald-400 text-xs font-mono">
        <TrendingUp size={12} />
        <span>{trend}</span>
      </div>
    )}
  </motion.div>
)};
