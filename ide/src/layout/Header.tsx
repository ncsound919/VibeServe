/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from 'motion/react';
import { Zap, Activity, RefreshCcw, Cpu, MessageSquare } from 'lucide-react';
import { NotificationPanel } from '../components/NotificationPanel';
import { PresenceBar } from '../components/PresenceBar';
import { useState, useEffect } from 'react';

interface HeaderProps {
  loading: boolean;
  onRefresh: () => void;
  chatOpen: boolean;
  onChatToggle: () => void;
}

export const Header = ({ loading, onRefresh, chatOpen, onChatToggle }: HeaderProps) => {
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
    <header className="h-16 border-b border-[#21262d] flex items-center justify-between px-6 bg-[#161b22] sticky top-0 z-50" role="banner" aria-label="VibeServe header">
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 bg-[#58a6ff] rounded-lg flex items-center justify-center">
          <Zap size={18} className="text-[#0d1117]" />
        </div>
        <div>
          <h1 className="text-sm font-mono uppercase tracking-[0.2em] font-bold text-[#c9d1d9]">VibeServe</h1>
          <p className="text-[10px] text-[#484f58] font-mono">AI-Powered IDE</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <AnimatePresence>
          {!loading && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 px-3 py-1 bg-[#1f6feb]/10 border border-[#1f6feb]/20 rounded-full text-[10px] font-mono text-[#58a6ff]"
            >
              <Zap size={12} fill="currentColor" />
              AGENTIC_PIPELINE_ACTIVE
            </motion.div>
          )}
        </AnimatePresence>
        {privacyMode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#2ea043]/10 border border-[#2ea043]/20 rounded-full text-[10px] font-mono text-[#3fb950]"
          >
            <Cpu size={11} />
            Local
          </motion.div>
        )}
        <div className="flex items-center gap-2 text-[#484f58] text-xs font-mono">
          <Activity size={14} className="text-[#3fb950]" />
          <span aria-live="polite">SYNCED</span>
        </div>
        <button
          onClick={onChatToggle}
          aria-label="Toggle chat panel"
          className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg transition-colors text-xs font-mono ${
            chatOpen
              ? 'border-[#58a6ff]/30 bg-[#1f6feb]/10 text-[#58a6ff]'
              : 'border-[#30363d] text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]'
          }`}
        >
          <MessageSquare size={14} />
          CHAT
        </button>
        <button
          id="btn-refresh-data"
          onClick={onRefresh}
          aria-label="Refresh data"
          className="flex items-center gap-2 px-3 py-1.5 border border-[#30363d] rounded-lg hover:bg-[#21262d] transition-colors text-xs font-mono text-[#8b949e] hover:text-[#c9d1d9]"
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
