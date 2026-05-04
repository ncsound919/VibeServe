import { motion } from 'motion/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface VibeCoderProgressProps {
  status: 'generating' | 'building' | 'testing' | 'done' | 'error';
  message: string;
  logs?: string[];
  appPath?: string;
}

const PHASE_LABELS: Record<VibeCoderProgressProps['status'], string> = {
  generating: 'Planning your app\'s architecture...',
  building: 'Installing dependencies and building...',
  testing: 'Testing your app...',
  done: 'Your app is ready!',
  error: 'Something went wrong',
};

const PHASE_ORDER = ['generating', 'building', 'testing', 'done'] as const;

export const VibeCoderProgress = ({ status, message, logs, appPath }: VibeCoderProgressProps) => {
  const [showDetails, setShowDetails] = useState(false);
  const currentPhaseIndex = PHASE_ORDER.indexOf(status as typeof PHASE_ORDER[number]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <motion.div
          animate={status !== 'error' && status !== 'done' ? { scale: [1, 1.2, 1] } : {}}
          transition={status !== 'error' && status !== 'done' ? { repeat: Infinity, duration: 2 } : {}}
          className="relative"
        >
          <div className={status === 'error'
            ? 'w-3 h-3 rounded-full bg-red-500'
            : status === 'done'
              ? 'w-3 h-3 rounded-full bg-emerald-500'
              : 'w-3 h-3 rounded-full bg-emerald-500 animate-pulse'
          } />
        </motion.div>
        <span className="text-sm font-mono text-white">
          {PHASE_LABELS[status]}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-4">
        {PHASE_ORDER.map((phase, i) => (
          <div key={phase} className="flex items-center gap-2 flex-1">
            <div className={`h-1 flex-1 rounded-full ${
              i < currentPhaseIndex
                ? 'bg-emerald-500'
                : i === currentPhaseIndex && status !== 'error'
                  ? 'bg-emerald-500/50 animate-pulse'
                  : 'bg-[#2d2e32]'
            }`} />
            {i < PHASE_ORDER.length - 1 && (
              <div className={`w-2 h-2 rounded-full ${
                i < currentPhaseIndex
                  ? 'bg-emerald-500'
                  : 'bg-[#2d2e32]'
              }`} />
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-between text-[10px] font-mono text-[#6B7280] uppercase tracking-widest mb-4">
        {PHASE_ORDER.map((phase, i) => (
          <span key={phase} className={i <= currentPhaseIndex ? 'text-emerald-400' : ''}>
            {phase === 'generating' ? 'Plan' : phase === 'building' ? 'Build' : phase === 'testing' ? 'Test' : 'Ready'}
          </span>
        ))}
      </div>

      {message && (
        <p className="text-xs font-mono text-[#9CA3AF] mb-4 text-center">{message}</p>
      )}

      {appPath && status === 'done' && (
        <div className="bg-[#151619] border border-[#2d2e32] rounded-lg p-3 mb-4">
          <span className="text-[10px] text-[#6B7280] font-mono uppercase tracking-widest">App Path</span>
          <p className="text-xs font-mono text-emerald-400 mt-1 break-all">{appPath}</p>
        </div>
      )}

      {logs && logs.length > 0 && (
        <div className="mt-4">
          <button
            aria-label="Toggle details"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-[10px] font-mono text-[#6B7280] hover:text-[#9CA3AF] focus-visible:ring-2 focus-visible:ring-emerald-500/50 transition-colors uppercase tracking-widest"
          >
            {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Details
          </button>
          {showDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="bg-[#0a0a0c] border border-[#1a1b1e] rounded-lg p-3 mt-2 max-h-48 overflow-y-auto custom-scrollbar"
            >
              {logs.map((log, i) => (
                <p key={i} className="text-[10px] font-mono text-[#6B7280] leading-relaxed">{log}</p>
              ))}
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};
