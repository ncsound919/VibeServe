import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Play, Trash2, Loader2, ChevronDown, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { runBrowserCommand, getDefaultCommands, type BrowserHarnessResult } from '../../services/browserHarnessClient';
import { cn } from '../../lib/utils';

interface HarnessEntry {
  id: string;
  command: string;
  result: BrowserHarnessResult;
  timestamp: Date;
  expanded: boolean;
}

export const BrowserHarnessPanel = () => {
  const [entries, setEntries] = useState<HarnessEntry[]>([]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const presets = getDefaultCommands();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [entries]);

  const execute = async (cmd: string) => {
    if (!cmd.trim() || running) return;
    setRunning(true);
    setShowPresets(false);

    const entry: HarnessEntry = {
      id: Math.random().toString(36).slice(2, 10),
      command: cmd.trim(),
      result: { success: true, output: '', simulated: false, duration: 0 },
      timestamp: new Date(),
      expanded: true,
    };

    setEntries(prev => [...prev, entry]);
    setInput('');

    const result = await runBrowserCommand(cmd);
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, result } : e));
    setRunning(false);
  };

  const clearHistory = () => setEntries([]);

  const toggleEntry = (id: string) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, expanded: !e.expanded } : e));
  };

  return (
    <div className="bg-[#0a0a0c] border border-[#2d2e32] rounded-xl overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="bg-[#151619] border-b border-[#2d2e32] px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-emerald-400" />
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#8E9299]">
            Browser Harness Terminal
          </span>
        </div>
        <div className="flex items-center gap-2">
          {running && <Loader2 size={12} className="animate-spin text-emerald-400" />}
          <button
            onClick={clearHistory}
            className="text-[9px] font-mono text-[#4a4b50] hover:text-rose-400 transition-colors flex items-center gap-1"
          >
            <Trash2 size={10} />
            CLEAR
          </button>
        </div>
      </div>

      {/* Output */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 font-mono text-[11px]">
        {entries.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-[#4a4b50] space-y-4">
            <Terminal size={32} className="opacity-30" />
            <p className="text-[10px] uppercase tracking-widest opacity-50">
              Enter a browser-harness command below
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              {Object.entries(presets).map(([name, cmd]) => (
                <button
                  key={name}
                  onClick={() => setInput(cmd)}
                  className="text-[9px] font-mono bg-[#151619] border border-[#2d2e32] px-2 py-1 rounded text-[#8E9299] hover:text-emerald-400 hover:border-emerald-500/30 transition-all"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {entries.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#151619] border border-[#2d2e32] rounded-lg overflow-hidden"
            >
              {/* Command header */}
              <button
                onClick={() => toggleEntry(entry.id)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#1a1b1e] transition-colors text-left"
              >
                {entry.expanded ? <ChevronDown size={10} className="text-[#4a4b50]" /> : <ChevronRight size={10} className="text-[#4a4b50]" />}
                {entry.result.simulated ? (
                  <AlertCircle size={10} className="text-amber-400" />
                ) : entry.result.success ? (
                  <CheckCircle2 size={10} className="text-emerald-400" />
                ) : (
                  <AlertCircle size={10} className="text-rose-400" />
                )}
                <span className="text-[#8E9299] truncate flex-1">$ {entry.command}</span>
                <span className="text-[8px] text-[#4a4b50]">{entry.result.duration}ms</span>
                {entry.result.simulated && (
                  <span className="text-[8px] font-mono bg-amber-500/10 border border-amber-500/20 px-1 py-0.5 rounded text-amber-400 uppercase">
                    SIM
                  </span>
                )}
              </button>

              {/* Output body */}
              <AnimatePresence>
                {entry.expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <pre className="px-3 pb-2 pt-1 text-[10px] text-[#8E9299] leading-relaxed whitespace-pre-wrap font-mono border-t border-[#2d2e32]/50">
                      {entry.result.success
                        ? entry.result.output || '(no output)'
                        : `[ERROR] ${entry.result.output}`}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Presets dropdown */}
      <div className="relative shrink-0">
        <AnimatePresence>
          {showPresets && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full left-0 right-0 bg-[#151619] border border-[#2d2e32] rounded-t-xl overflow-hidden shadow-2xl z-50"
            >
              {Object.entries(presets).map(([name, cmd]) => (
                <button
                  key={name}
                  onClick={() => { setInput(cmd); setShowPresets(false); inputRef.current?.focus(); }}
                  className="w-full text-left px-4 py-2 text-[11px] font-mono text-[#8E9299] hover:bg-[#1a1b1e] hover:text-white border-b border-[#2d2e32]/50 last:border-0 transition-colors"
                >
                  <span className="text-emerald-400/50 mr-2">$</span>
                  <span className="text-[9px] text-[#4a4b50] mr-2 uppercase">{name}:</span>
                  {cmd.slice(0, 60)}{cmd.length > 60 ? '...' : ''}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="border-t border-[#2d2e32] p-3 shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); execute(input); }}
          className="flex items-center gap-2"
        >
          <button
            type="button"
            onClick={() => setShowPresets(!showPresets)}
            className="text-[9px] font-mono text-[#4a4b50] hover:text-white bg-[#151619] border border-[#2d2e32] px-2 py-1.5 rounded transition-colors"
          >
            +CMD
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter browser-harness command..."
            disabled={running}
            className="flex-1 bg-[#151619] border border-[#2d2e32] rounded px-3 py-1.5 text-[11px] font-mono text-white placeholder-[#4a4b50] focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || running}
            className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono px-3 py-1.5 rounded hover:bg-emerald-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {running ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
            RUN
          </button>
        </form>
      </div>
    </div>
  );
};
