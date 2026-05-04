import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, Info, TrendingUp, TrendingDown } from 'lucide-react';

interface DebtRadarReport {
  todos: number;
  complexity: 'low' | 'medium' | 'high';
  debtScore: number;
  untypedExports: number;
  recommendation: string;
}

export const DebtRadar = () => {
  const [report, setReport] = useState<DebtRadarReport | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // In a real app, this would trigger on file change. 
  // For now, we'll simulate scanning the current view context.
  useEffect(() => {
    const scan = async () => {
      try {
        const res = await fetch('/api/tools/debt', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-api-key': 'nexus-alpha-dev-key'
          },
          body: JSON.stringify({ content: 'export const test = () => { if(true) { if(false) { // TODO: fix this } } }' })
        });
        const data = await res.json();
        setReport(data);
      } catch (err) {
        console.error('Debt Radar Error:', err);
      }
    };
    scan();
    const interval = setInterval(scan, 30000); // Scan every 30s
    return () => clearInterval(interval);
  }, []);

  if (!report) return null;

  const getScoreColor = (score: number) => {
    if (score > 50) return 'text-red-400';
    if (score > 20) return 'text-amber-400';
    return 'text-green-400';
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1 hover:bg-white/5 transition-colors group"
      >
        <ShieldAlert className={`w-3.5 h-3.5 ${getScoreColor(report.debtScore)} animate-pulse-soft`} />
        <span className="text-[10px] font-mono font-bold tracking-tight text-gray-500 group-hover:text-gray-300">
          DEBT: {report.debtScore}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full right-0 mb-2 w-64 glass-card rounded-xl p-4 aura-glow border-white/10"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Technical Debt Radar</span>
              <ShieldAlert className={`w-3 h-3 ${getScoreColor(report.debtScore)}`} />
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 flex items-center gap-2">
                  <Info className="w-3 h-3" /> Complexity
                </span>
                <span className={`text-xs font-mono font-bold uppercase ${report.complexity === 'high' ? 'text-red-400' : 'text-green-400'}`}>
                  {report.complexity}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 flex items-center gap-2">
                  <TrendingUp className="w-3 h-3" /> TODOs
                </span>
                <span className="text-xs font-mono text-white">{report.todos}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 flex items-center gap-2">
                  <TrendingDown className="w-3 h-3" /> Untyped
                </span>
                <span className="text-xs font-mono text-white">{report.untypedExports}</span>
              </div>

              <div className="pt-2 border-t border-white/5">
                <p className="text-[10px] leading-relaxed text-gray-500 italic">
                  "{report.recommendation}"
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
