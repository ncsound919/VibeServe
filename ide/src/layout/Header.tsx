/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from 'motion/react';
import { Zap, Activity, RefreshCcw, Cpu } from 'lucide-react';
import { NotificationPanel } from '../components/NotificationPanel';
import { PresenceBar } from '../components/PresenceBar';
import { useState, useEffect } from 'react';

interface HeaderProps {
  loading: boolean;
  onRefresh: () => void;
}

export const Header = ({ loading, onRefresh }: HeaderProps) => {
  const [privacyMode, setPrivacyMode] = useState(false);

  useEffect(() => {
    const check = () => {
      setPrivacyMode(localStorage.getItem('nexus_privacy_mode') === 'true');
    };
    check();
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);
  return (
    <header className="h-16 border-b border-[#1a1b1e] flex items-center justify-between px-8 bg-[#0a0a0c] sticky top-0 z-50" role="banner" aria-label="Nexus Alpha header">
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center">
          <Zap size={20} className="text-black" />
        </div>
        <div>
          <h1 className="text-sm font-mono uppercase tracking-[0.3em] font-bold">Nexus Alpha</h1>
          <p className="text-[10px] text-[#4a4b50] font-mono">v4.0.2 • PREDICTIVE ANALYTICS ENGINE</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <AnimatePresence>
          {!loading && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded text-[10px] font-mono text-emerald-400"
            >
              <Zap size={12} fill="currentColor" />
              SYSTEM UPGRADED: AGENTIC_BROWSER_ACTIVE
            </motion.div>
          )}
        </AnimatePresence>
        {privacyMode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-[10px] font-mono text-emerald-400"
          >
            <Cpu size={11} />
            Local
          </motion.div>
        )}
        <div className="flex items-center gap-2 text-[#4a4b50] text-xs font-mono">
          <Activity size={14} className="text-emerald-500" />
          <span aria-live="polite">GLOBAL SYNCED</span>
        </div>
        <button
          id="btn-refresh-data"
          onClick={onRefresh}
          aria-label="Refresh data"
          className="flex items-center gap-2 px-3 py-1.5 border border-[#2d2e32] rounded hover:bg-[#1a1b1e] transition-colors text-xs font-mono text-[#8E9299]"
        >
          <RefreshCcw size={14} />
          REFRESH
        </button>
        <NotificationPanel />
        <PresenceBar />
      </div>
    </header>
  );
};
