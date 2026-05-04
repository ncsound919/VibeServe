/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LucideIcon } from 'lucide-react';

interface SectionHeaderProps {
  title: string;
  icon: LucideIcon;
}

export const SectionHeader = ({ title, icon: Icon }: SectionHeaderProps) => (
  <div className="flex items-center gap-2 border-b border-[#2d2e32] pb-2">
    <Icon size={16} className="text-[#8E9299]" />
    <h2 className="text-sm font-mono uppercase tracking-[0.2em] text-[#8E9299]">{title}</h2>
  </div>
);
