/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Anchor, Play, Pause, Plus, Trash2, Settings, CheckCircle2, XCircle, 
  AlertTriangle, ChevronDown, ChevronRight, Terminal, Clock
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { HookConfig, HookResult } from '../../types';

interface HookManagerPanelProps {
  hooks: HookConfig[];
  results?: HookResult[];
  onToggle?: (hookId: string, enabled: boolean) => void;
  onDelete?: (hookId: string) => void;
  onAdd?: () => void;
}

const phaseColors: Record<string, string> = {
  pre: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
  post: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  on_error: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
};

const actionIcons: Record<string, React.ReactNode> = {
  allow: <CheckCircle2 size={12} className="text-emerald-400" />,
  block: <XCircle size={12} className="text-rose-400" />,
  warn: <AlertTriangle size={12} className="text-amber-400" />,
};

export const HookManagerPanel: React.FC<HookManagerPanelProps> = ({
  hooks,
  results = [],
  onToggle,
  onDelete,
  onAdd,
}) => {
  const [expandedHook, setExpandedHook] = useState<string | null>(null);

  return (
    <div className="bg-[#151619] border border-[#2d2e32] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d2e32]">
        <div className="flex items-center gap-2">
          <Anchor size={14} className="text-emerald-400" />
          <span className="text-xs font-mono text-[#8E9299] uppercase tracking-widest">
            Pipeline Hooks
          </span>
          <span className="text-[10px] text-[#4a4b50] font-mono">
            ({hooks.filter(h => h.enabled).length}/{hooks.length} active)
          </span>
        </div>
        {onAdd && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <Plus size={12} />
            <span>Add Hook</span>
          </button>
        )}
      </div>

      <div className="divide-y divide-[#1a1b1e]">
        {hooks.map((hook) => {
          const result = results.find(r => r.hookId === hook.id);
          const isExpanded = expandedHook === hook.id;

          return (
            <div key={hook.id}>
              <div
                className={cn(
                  'flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#1a1b1e]/50 transition-colors',
                  !hook.enabled && 'opacity-50'
                )}
                onClick={() => setExpandedHook(isExpanded ? null : hook.id)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown size={14} className="text-[#4a4b50]" /> : <ChevronRight size={14} className="text-[#4a4b50]" />}
                  <div className={cn('px-2 py-0.5 rounded text-[9px] font-mono border', phaseColors[hook.phase])}>
                    {hook.phase}
                  </div>
                  <span className="text-xs font-medium text-[#8E9299]">{hook.name}</span>
                  <span className="text-[10px] font-mono text-[#4a4b50]">{hook.pipelinePhase}</span>
                </div>

                <div className="flex items-center gap-2">
                  {result && (
                    <div className={cn('px-2 py-0.5 rounded text-[9px] font-mono flex items-center gap-1', result.passed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400')}>
                      {result.passed ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                      {result.durationMs}ms
                    </div>
                  )}
                  {actionIcons[hook.action]}
                  {onToggle && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggle(hook.id, !hook.enabled); }}
                      className={cn('p-1 rounded transition-colors', hook.enabled ? 'text-emerald-400 hover:text-emerald-300' : 'text-[#4a4b50] hover:text-[#8E9299]')}
                    >
                      {hook.enabled ? <Pause size={12} /> : <Play size={12} />}
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(hook.id); }}
                      className="p-1 text-[#4a4b50] hover:text-rose-400 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-[#0a0a0c] border-t border-[#1a1b1e] px-4 py-3"
                  >
                    <div className="grid grid-cols-2 gap-3 text-[10px]">
                      <div>
                        <div className="text-[#4a4b50] font-mono mb-1">ACTION</div>
                        <div className="text-[#8E9299] font-mono uppercase">{hook.action}</div>
                      </div>
                      {hook.condition && (
                        <div>
                          <div className="text-[#4a4b50] font-mono mb-1">CONDITION</div>
                          <div className="text-[#8E9299] font-mono">{hook.condition}</div>
                        </div>
                      )}
                      {hook.script && (
                        <div className="col-span-2">
                          <div className="text-[#4a4b50] font-mono mb-1">SCRIPT</div>
                          <pre className="text-[9px] font-mono text-[#8E9299] bg-[#151619] p-2 rounded overflow-x-auto">
                            {hook.script}
                          </pre>
                        </div>
                      )}
                      {result && (
                        <>
                          <div>
                            <div className="text-[#4a4b50] font-mono mb-1">LOGS</div>
                            <div className="space-y-1 max-h-20 overflow-y-auto">
                              {result.logs.map((log, i) => (
                                <div key={i} className="text-[9px] font-mono text-emerald-500/70">{log}</div>
                              ))}
                            </div>
                          </div>
                          {result.warnings.length > 0 && (
                            <div>
                              <div className="text-[#4a4b50] font-mono mb-1">WARNINGS</div>
                              <div className="space-y-1">
                                {result.warnings.map((warn, i) => (
                                  <div key={i} className="text-[9px] font-mono text-amber-400">{warn}</div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {hooks.length === 0 && (
        <div className="p-8 text-center">
          <Anchor size={24} className="text-[#4a4b50] mx-auto mb-2" />
          <p className="text-[10px] font-mono text-[#4a4b50]">No hooks configured</p>
        </div>
      )}
    </div>
  );
};
