/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal as TerminalIcon, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { CLIStateData } from '../../types';

interface CLITerminalProps {
  state: CLIStateData;
  onCommand: (cmd: string) => void;
  onProviderChange: (provider: 'opencode' | 'openrouter' | 'deepseek') => void;
}

export const CLITerminal = ({ state, onCommand, onProviderChange }: CLITerminalProps) => {
  const [input, setInput] = useState('');
  const [pendingProvider, setPendingProvider] = useState<'opencode' | 'openrouter' | 'deepseek' | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [state.output]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onCommand(input);
    setInput('');
  };

  const confirmSwitch = () => {
    if (pendingProvider) {
      onProviderChange(pendingProvider);
      setPendingProvider(null);
    }
  };

  return (
    <div className="bg-[#0a0a0c] border border-[#2d2e32] rounded-xl flex flex-col h-[450px] overflow-hidden shadow-2xl relative">
      {/* Confirmation Overlay */}
      <AnimatePresence>
        {pendingProvider && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-[#0a0a0c]/90 backdrop-blur-sm flex items-center justify-center p-6 text-center"
          >
            <div className="max-w-xs space-y-6">
              <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-400 mx-auto animate-pulse">
                <AlertCircle size={24} />
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-white uppercase tracking-widest">Confirm Protocol Shift</h4>
                <p className="text-[10px] font-mono text-[#4a4b50] leading-relaxed">
                  You are about to switch from{' '}
                  <span className="text-white">{state.activeProvider.toUpperCase()}</span> to{' '}
                  <span className="text-blue-400">{pendingProvider.toUpperCase()}</span>.
                  Current terminal context will be recalibrated.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setPendingProvider(null)}
                  className="flex-1 py-2 bg-[#1a1b1e] hover:bg-[#2d2e32] border border-[#2d2e32] rounded text-[9px] font-mono text-[#4a4b50] uppercase tracking-widest transition-all"
                >
                  [ABORT]
                </button>
                <button
                  onClick={confirmSwitch}
                  className="flex-1 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 rounded text-[9px] font-mono text-blue-400 uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                >
                  [CONFIRM_SHIFT]
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-[#151619] px-4 py-2 border-b border-[#2d2e32] flex justify-between items-center">
        <div className="flex items-center gap-2">
          <TerminalIcon size={14} className="text-[#4a4b50]" />
          <span className="text-[10px] font-mono text-[#4a4b50] uppercase tracking-widest">
            Nexus-Terminal_v1.2.0
          </span>
        </div>
        <div className="flex gap-2">
          {(['opencode', 'openrouter', 'deepseek'] as const).map(p => (
            <button
              key={p}
              onClick={() => {
                if (state.activeProvider !== p) {
                  setPendingProvider(p);
                }
              }}
              className={cn(
                'text-[9px] font-mono px-2 py-0.5 rounded border transition-all',
                state.activeProvider === p
                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-400 ring-1 ring-blue-500/20'
                  : 'bg-[#0a0a0c] border-[#1a1b1e] text-[#4a4b50] hover:border-[#2d2e32] hover:text-[#8E9299]',
              )}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={terminalRef}
        className="flex-1 p-4 font-mono text-[11px] overflow-y-auto space-y-1 custom-scrollbar"
      >
        {state.output.map((line, i) => (
          <div
            key={i}
            className={cn(
              line.startsWith('>') ? 'text-blue-400' :
              line.includes('[ERROR]') ? 'text-rose-400' :
              line.includes('[SYSTEM]') ? 'text-emerald-400' : 'text-[#8E9299]',
            )}
          >
            {line}
          </div>
        ))}
        <div className="text-white animate-pulse">_</div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 bg-[#151619] border-t border-[#2d2e32] flex gap-3">
        <span className="text-blue-400 font-mono mt-1">$</span>
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Execute protocol (e.g. opencode push --agent-v1)..."
          className="flex-1 bg-transparent border-none outline-none text-white font-mono text-xs placeholder:text-[#2d2e32]"
        />
      </form>
    </div>
  );
};
