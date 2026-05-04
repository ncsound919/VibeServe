/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  GitBranch, CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight,
  Play, Pause, AlertTriangle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ExecutionPlan, PlanStep } from '../../types';

interface PlanApprovalPanelProps {
  plan: ExecutionPlan | null;
  onApprove?: (planId: string) => void;
  onReject?: (planId: string) => void;
  onExecute?: (planId: string) => void;
}

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
};

export const PlanApprovalPanel: React.FC<PlanApprovalPanelProps> = ({
  plan,
  onApprove,
  onReject,
  onExecute,
}) => {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  if (!plan) {
    return (
      <div className="bg-[#151619] border border-[#2d2e32] rounded-xl p-8 text-center">
        <GitBranch size={24} className="text-[#4a4b50] mx-auto mb-2" />
        <p className="text-[10px] font-mono text-[#4a4b50]">No execution plan pending</p>
      </div>
    );
  }

  const approved = plan.approved === true;
  const rejected = plan.approved === false;
  const canApprove = plan.requiresApproval && !approved && !rejected;

  return (
    <div className="bg-[#151619] border border-[#2d2e32] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d2e32]">
        <div className="flex items-center gap-2">
          <GitBranch size={14} className="text-blue-400" />
          <span className="text-xs font-mono text-[#8E9299] uppercase tracking-widest">
            Execution Plan
          </span>
          <span className="text-[10px] font-mono text-[#4a4b50]">
            {plan.id.slice(0, 8)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={10} className="text-[#4a4b50]" />
          <span className="text-[9px] font-mono text-[#4a4b50]">
            Est. {formatDuration(plan.estimatedDuration)}
          </span>
        </div>
      </div>

      <div className="px-4 py-3 bg-[#0a0a0c] border-b border-[#1a1b1e]">
        <div className="text-[10px] font-medium text-[#8E9299] mb-1">{plan.description}</div>
        <div className="text-[9px] font-mono text-[#4a4b50]">
          {plan.steps.length} steps • Created {new Date(plan.createdAt).toLocaleTimeString()}
        </div>
      </div>

      <div className="divide-y divide-[#1a1b1e] max-h-64 overflow-y-auto">
        {plan.steps.map((step, index) => {
          const isExpanded = expandedStep === step.id;

          return (
            <div key={step.id}>
              <div
                className="flex items-center justify-between px-4 py-2 hover:bg-[#1a1b1e]/50 cursor-pointer transition-colors"
                onClick={() => setExpandedStep(isExpanded ? null : step.id)}
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronDown size={12} className="text-[#4a4b50]" /> : <ChevronRight size={12} className="text-[#4a4b50]" />}
                  <span className="text-[10px] font-mono text-[#4a4b50]">{String(index + 1).padStart(2, '0')}</span>
                  <span className="text-xs text-[#8E9299]">{step.description}</span>
                </div>
                <span className="text-[9px] font-mono text-[#4a4b50]">
                  {formatDuration(step.estimatedDuration)}
                </span>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-[#0a0a0c] px-4 py-2 border-t border-[#1a1b1e] text-[9px] font-mono space-y-1"
                  >
                    {step.command && (
                      <div className="text-[#4a4b50]">Command: <span className="text-emerald-500">{step.command}</span></div>
                    )}
                    {step.files && step.files.length > 0 && (
                      <div className="text-[#4a4b50]">
                        Files: <span className="text-blue-400">{step.files.join(', ')}</span>
                      </div>
                    )}
                    {step.dependsOn.length > 0 && (
                      <div className="text-[#4a4b50]">
                        Depends on: <span className="text-purple-400">{step.dependsOn.join(', ')}</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {canApprove && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#2d2e32] bg-[#0a0a0c]">
          <div className="flex items-center gap-2 text-amber-400 text-[9px] font-mono">
            <AlertTriangle size={10} />
            <span>Requires approval</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onReject?.(plan.id)}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-[9px] font-mono bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
            >
              <XCircle size={10} />
              Reject
            </button>
            <button
              onClick={() => onApprove?.(plan.id)}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
            >
              <CheckCircle2 size={10} />
              Approve
            </button>
          </div>
        </div>
      )}

      {approved && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#2d2e32] bg-emerald-500/5">
          <div className="flex items-center gap-2 text-emerald-400 text-[9px] font-mono">
            <CheckCircle2 size={10} />
            <span>Plan approved</span>
          </div>
          {onExecute && (
            <button
              onClick={() => onExecute?.(plan.id)}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-[9px] font-mono bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
            >
              <Play size={10} />
              Execute
            </button>
          )}
        </div>
      )}

      {rejected && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#2d2e32] bg-rose-500/5">
          <div className="flex items-center gap-2 text-rose-400 text-[9px] font-mono">
            <XCircle size={10} />
            <span>Plan rejected</span>
          </div>
        </div>
      )}
    </div>
  );
};
