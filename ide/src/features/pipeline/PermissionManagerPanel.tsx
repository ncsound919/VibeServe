/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Shield, CheckCircle2, XCircle, HelpCircle, Eye, Edit, Terminal, Globe, Server } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { PermissionRule, PermissionScope } from '../../types';

interface PermissionManagerPanelProps {
  rules: PermissionRule[];
  onToggle?: (ruleId: string, enabled: boolean) => void;
}

const scopeIcons: Record<PermissionScope, React.ReactNode> = {
  read: <Eye size={12} />,
  edit: <Edit size={12} />,
  bash: <Terminal size={12} />,
  network: <Globe size={12} />,
  system: <Server size={12} />,
};

const scopeColors: Record<PermissionScope, string> = {
  read: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  edit: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  bash: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  network: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  system: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
};

const actionColors: Record<string, string> = {
  allow: 'text-emerald-400 bg-emerald-500/10',
  ask: 'text-amber-400 bg-amber-500/10',
  deny: 'text-rose-400 bg-rose-500/10',
};

export const PermissionManagerPanel: React.FC<PermissionManagerPanelProps> = ({
  rules,
  onToggle,
}) => {
  return (
    <div className="bg-[#151619] border border-[#2d2e32] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d2e32]">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-blue-400" />
          <span className="text-xs font-mono text-[#8E9299] uppercase tracking-widest">
            Permission Rules
          </span>
          <span className="text-[10px] text-[#4a4b50] font-mono">
            ({rules.filter(r => r.enabled).length}/{rules.length} active)
          </span>
        </div>
      </div>

      <div className="divide-y divide-[#1a1b1e] max-h-80 overflow-y-auto">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className={cn(
              'flex items-center justify-between px-4 py-3 hover:bg-[#1a1b1e]/50 transition-colors',
              !rule.enabled && 'opacity-50'
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn('p-1.5 rounded border', scopeColors[rule.scope])}>
                {scopeIcons[rule.scope]}
              </div>
              <div>
                <div className="text-xs font-medium text-[#8E9299]">{rule.scope}</div>
                {rule.pattern && (
                  <div className="text-[9px] font-mono text-[#4a4b50]">{rule.pattern}</div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className={cn('px-2 py-1 rounded text-[9px] font-mono flex items-center gap-1', actionColors[rule.action])}>
                {rule.action === 'allow' && <CheckCircle2 size={10} />}
                {rule.action === 'deny' && <XCircle size={10} />}
                {rule.action === 'ask' && <HelpCircle size={10} />}
                {rule.action}
              </div>
              {onToggle && (
                <button
                  onClick={() => onToggle(rule.id, !rule.enabled)}
                  className={cn(
                    'text-[10px] font-mono uppercase',
                    rule.enabled ? 'text-emerald-400' : 'text-[#4a4b50]'
                  )}
                >
                  {rule.enabled ? 'enabled' : 'disabled'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {rules.length === 0 && (
        <div className="p-8 text-center">
          <Shield size={24} className="text-[#4a4b50] mx-auto mb-2" />
          <p className="text-[10px] font-mono text-[#4a4b50]">No permission rules configured</p>
        </div>
      )}
    </div>
  );
};
