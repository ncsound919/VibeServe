import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Terminal, Zap, FileCode, Settings, Play } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { usePipelineStore } from '../stores/usePipelineStore';

export const GlobalCommandBar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { setActiveTab } = useAppStore();
  const { startPipeline } = usePipelineStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const commands = [
    { id: 'overview', label: 'Go to Overview', icon: Zap, action: () => setActiveTab('Overview') },
    { id: 'composer', label: 'Open Composer', icon: FileCode, action: () => setActiveTab('Composer') },
    { id: 'pipeline', label: 'Run Pipeline', icon: Play, action: () => startPipeline(['Nexus-Alpha']) },
    { id: 'terminal', label: 'Show Command Center', icon: Terminal, action: () => setActiveTab('Command Center') },
    { id: 'settings', label: 'System Settings', icon: Settings, action: () => setActiveTab('Settings') },
  ].filter(c => c.label.toLowerCase().includes(query.toLowerCase()));

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50"
          >
            <div className="glass-card rounded-2xl overflow-hidden shadow-2xl border border-white/10 aura-glow" role="dialog" aria-modal="true" aria-label="Command palette">
              <div className="flex items-center p-4 border-b border-white/10 gap-3">
                <Search className="w-5 h-5 text-gray-500" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search commands or talk to Nexus..."
                  aria-label="Command search"
                  aria-autocomplete="list"
                  aria-controls="command-results"
                  className="bg-transparent border-none outline-none text-white w-full font-sans text-lg placeholder:text-gray-600"
                />
                <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-gray-500 font-mono">ESC</kbd>
              </div>
              <div id="command-results" className="max-h-[300px] overflow-y-auto p-2" role="listbox" aria-label="Search results">
                {commands.map((cmd, i) => (
                  <button
                    key={cmd.id}
                    onClick={() => handleAction(cmd.action)}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${i === selectedIndex ? 'bg-indigo-500/20 text-white' : 'text-gray-400 hover:bg-white/5'}`}
                    role="option"
                    aria-selected={i === selectedIndex}
                  >
                    <cmd.icon className={`w-4 h-4 ${i === selectedIndex ? 'text-indigo-400' : 'text-gray-500'}`} />
                    <span className="font-mono text-sm">{cmd.label}</span>
                  </button>
                ))}
                {commands.length === 0 && (
                  <div className="p-8 text-center text-gray-500 text-sm italic">
                    No commands found for "{query}"
                  </div>
                )}
              </div>
              <div className="p-3 bg-white/[0.02] border-t border-white/10 flex justify-between items-center px-4">
                <div className="flex gap-4">
                  <span className="text-[10px] text-gray-500 flex items-center gap-1"><kbd className="px-1 py-0.5 bg-white/5 rounded">↵</kbd> to select</span>
                  <span className="text-[10px] text-gray-500 flex items-center gap-1"><kbd className="px-1 py-0.5 bg-white/5 rounded">↑↓</kbd> to navigate</span>
                </div>
                <span className="text-[10px] text-indigo-400/70 font-mono">NEXUS_OMNI_V1</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
