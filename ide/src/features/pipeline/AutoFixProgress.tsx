/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { Wrench, CheckCircle2, XCircle, RefreshCcw } from 'lucide-react';
import { cn } from '../../lib/utils';

interface FixAttempt {
  id: string;
  attemptNumber: number;
  phase: string;
  errorMessage: string;
  errorType: string;
  diagnosis: string;
  fixDescription: string;
  fixCode?: string;
  targetFile?: string;
  applied: boolean;
  success: boolean;
  timestamp: string;
  durationMs: number;
}

interface AutoFixProgressProps {
  fixAttempts: FixAttempt[];
  autoFixActive?: boolean;
}

export const AutoFixProgress = ({ fixAttempts, autoFixActive }: AutoFixProgressProps) => {
  if (fixAttempts.length === 0 && !autoFixActive) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-blue-500/5 border-blue-500/10 rounded-xl p-4 mb-6"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center',
          autoFixActive ? 'bg-amber-500/10 animate-pulse' : 'bg-blue-500/10'
        )}>
          <Wrench size={16} className={autoFixActive ? 'text-amber-400' : 'text-blue-400'} />
        </div>
        <div>
          <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em] font-mono">
            {autoFixActive ? 'Auto-Fix Active' : `Auto-Fix Results (${fixAttempts.length} attempts)`}
          </h4>
          <p className="text-[9px] font-mono text-[#4a4b50]">
            {autoFixActive ? 'Analyzing error and generating fixes...' : 
             `${fixAttempts.filter(a => a.success).length} successful, ${fixAttempts.filter(a => !a.success).length} failed`}
          </p>
        </div>
      </div>

      {fixAttempts.length > 0 && (
        <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
          {fixAttempts.map((attempt) => (
            <motion.div
              key={attempt.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border text-xs',
                attempt.success
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : attempt.applied
                  ? 'bg-rose-500/5 border-rose-500/20'
                  : 'bg-[#0a0a0c] border-[#2d2e32]'
              )}
            >
              <div className="mt-0.5 shrink-0">
                {attempt.success
                  ? <CheckCircle2 size={14} className="text-emerald-400" />
                  : attempt.applied
                  ? <XCircle size={14} className="text-rose-400" />
                  : <RefreshCcw size={14} className="text-amber-400 animate-spin" />
                }
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono text-[#4a4b50] uppercase tracking-widest">
                    Attempt #{attempt.attemptNumber}
                  </span>
                  <span className={cn(
                    'text-[9px] font-mono px-1 rounded',
                    attempt.errorType === 'network' ? 'bg-amber-500/10 text-amber-400' :
                    attempt.errorType === 'dependency' ? 'bg-purple-500/10 text-purple-400' :
                    attempt.errorType === 'compilation' ? 'bg-rose-500/10 text-rose-400' :
                    'bg-[#2d2e32] text-[#4a4b50]'
                  )}>
                    {attempt.errorType}
                  </span>
                </div>
                <p className="text-[#8E9299] leading-relaxed">{attempt.fixDescription}</p>
                {attempt.fixCode && (
                  <pre className="text-[9px] font-mono text-emerald-400/80 bg-[#0a0a0c] p-2 rounded overflow-x-auto max-w-full truncate">
                    {attempt.fixCode}
                  </pre>
                )}
                <div className="flex items-center gap-3 text-[9px] font-mono text-[#4a4b50]">
                  <span>{attempt.durationMs}ms</span>
                  {attempt.targetFile && <span>→ {attempt.targetFile}</span>}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};
