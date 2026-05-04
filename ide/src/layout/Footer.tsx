import { useState, useEffect } from 'react';
import { DebtRadar } from '../components/DebtRadar';

export const Footer = ({ latency = 42 }: { latency?: number }) => {
  const [uptime, setUptime] = useState(99.999);

  useEffect(() => {
    const i = setInterval(() => {
      setUptime(prev => {
        const delta = (Math.random() * 0.002) - 0.001;
        return Math.min(100, Math.max(99.98, prev + delta));
      });
    }, 10000);
    return () => clearInterval(i);
  }, []);

  return (
    <footer className="h-10 px-6 border-t border-white/5 bg-[#0A0A0B] flex items-center justify-between text-[#4a4b50] font-mono text-[9px] relative z-20" role="contentinfo" aria-label="System status">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500/50 animate-pulse" />
          <span aria-live="polite" aria-label={`Latency: ${latency} milliseconds`}>LATENCY: {latency}MS</span>
        </div>
        <span>UPTIME: {uptime.toFixed(3)}%</span>
        <span>CLUSTER: NEXUS-CORE-ALPHA</span>
      </div>

      <div className="flex items-center gap-8">
        <DebtRadar />
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-indigo-400 opacity-50">PRO_TRIAL</span>
          <span className="text-gray-600">© 2026 NEXUS ALPHA</span>
        </div>
      </div>
    </footer>
  );
};
