/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Brain, ChevronRight, Zap, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ModelProvider, ModelRoutingDecision, CodeAnalysisResult } from '../../types';

interface ModelRouterPanelProps {
  providers: ModelProvider[];
  currentDecision?: ModelRoutingDecision;
  complexity?: number;
  onToggleProvider?: (providerId: string, enabled: boolean) => void;
}

export const ModelRouterPanel: React.FC<ModelRouterPanelProps> = ({
  providers,
  currentDecision,
  complexity,
  onToggleProvider,
}) => {
  const sortedProviders = [...providers].sort((a, b) => a.priority - b.priority);

  return (
    <div className="bg-[#151619] border border-[#2d2e32] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d2e32]">
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-purple-400" />
          <span className="text-xs font-mono text-[#8E9299] uppercase tracking-widest">
            AI Model Router
          </span>
        </div>
        {complexity !== undefined && (
          <div className={cn(
            'px-2 py-1 rounded text-[9px] font-mono flex items-center gap-1',
            complexity > 70 ? 'bg-rose-500/10 text-rose-400' :
            complexity > 30 ? 'bg-amber-500/10 text-amber-400' :
            'bg-emerald-500/10 text-emerald-400'
          )}>
            <Zap size={10} />
            Complexity: {complexity}
          </div>
        )}
      </div>

      {currentDecision && (
        <div className="px-4 py-3 bg-[#0a0a0c] border-b border-[#1a1b1e]">
          <div className="text-[9px] font-mono text-[#4a4b50] uppercase mb-2">Current Routing Decision</div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-purple-400">
              {providers.find(p => p.id === currentDecision.providerId)?.name || currentDecision.providerId}
            </span>
            <ChevronRight size={12} className="text-[#4a4b50]" />
            <span className="text-[10px] text-[#8E9299]">{currentDecision.reasoning}</span>
          </div>
          {currentDecision.fallbackProvider && (
            <div className="text-[9px] font-mono text-amber-400 flex items-center gap-1">
              <AlertTriangle size={10} />
              Fallback: {providers.find(p => p.id === currentDecision.fallbackProvider)?.name}
            </div>
          )}
        </div>
      )}

      <div className="divide-y divide-[#1a1b1e]">
        {sortedProviders.map((provider, index) => {
          const isSelected = currentDecision?.providerId === provider.id;

          return (
            <motion.div
              key={provider.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                'flex items-center justify-between px-4 py-3 hover:bg-[#1a1b1e]/50 transition-colors',
                isSelected && 'bg-purple-500/5 border-l-2 border-purple-500',
                !provider.enabled && 'opacity-50'
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded bg-purple-500/10 flex items-center justify-center text-purple-400 text-[10px] font-mono">
                  {index + 1}
                </div>
                <div>
                  <div className="text-xs font-medium text-[#8E9299]">{provider.name}</div>
                  <div className="text-[9px] font-mono text-[#4a4b50]">{provider.modelId}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-[9px] font-mono text-[#4a4b50]">
                  Max complexity: {provider.maxComplexity}
                </div>
                {isSelected && (
                  <CheckCircle2 size={12} className="text-purple-400" />
                )}
                {onToggleProvider && (
                  <button
                    onClick={() => onToggleProvider(provider.id, !provider.enabled)}
                    className={cn(
                      'text-[9px] font-mono uppercase px-2 py-1 rounded',
                      provider.enabled ? 'text-emerald-400 bg-emerald-500/10' : 'text-[#4a4b50] bg-[#1a1b1e]'
                    )}
                  >
                    {provider.enabled ? 'active' : 'off'}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {providers.length === 0 && (
        <div className="p-8 text-center">
          <Brain size={24} className="text-[#4a4b50] mx-auto mb-2" />
          <p className="text-[10px] font-mono text-[#4a4b50]">No providers configured</p>
        </div>
      )}
    </div>
  );
};
