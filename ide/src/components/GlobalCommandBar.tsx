import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Terminal,
  Zap,
  FileCode,
  Settings,
  Play,
  Wand2,
  GitCompare,
  PanelRight,
  LayoutGrid,
  Keyboard,
  Copy,
  Save,
  SplitSquareVertical,
  Monitor,
  FolderOpen,
  type LucideIcon,
} from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { usePipelineStore } from '../stores/usePipelineStore';
import { useIDEStore } from '../stores/useIDEStore';

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  category: 'navigation' | 'editor' | 'pipeline' | 'view' | 'settings' | 'files';
  action: () => void;
  shortcut?: string;
}

interface FileEntry {
  path: string;
  name: string;
  appId: string;
}

let fileCache: FileEntry[] | null = null;
let fileCacheTime = 0;

export const GlobalCommandBar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const { setActiveTab } = useAppStore();
  const { startPipeline } = usePipelineStore();
  const { toggleBottomPanel, setBottomPanelActive, toggleSidebar, toggleAiPanel } =
    useIDEStore();
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch files on mount or when cache expires
  const fetchFiles = useCallback(async () => {
    if (fileCache && Date.now() - fileCacheTime < 30000) {
      setFiles(fileCache);
      return;
    }
    setLoadingFiles(true);
    try {
      const res = await fetch('/api/editor/files');
      const data = await res.json();
      if (data.files) {
        fileCache = data.files;
        fileCacheTime = Date.now();
        setFiles(data.files);
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  const allCommands = useCallback((): Command[] => {
    return [
      // Navigation
      {
        id: 'composer',
        label: 'Open Composer',
        description: 'Create new projects from templates',
        icon: Wand2,
        category: 'navigation',
        shortcut: 'Ctrl+1',
        action: () => setActiveTab('Composer'),
      },
      {
        id: 'editor',
        label: 'Open Editor',
        description: 'Edit files with Monaco editor',
        icon: FileCode,
        category: 'navigation',
        shortcut: 'Ctrl+2',
        action: () => setActiveTab('Editor'),
      },
      {
        id: 'magic',
        label: 'Magic Composer',
        description: 'One-prompt project generation',
        icon: Zap,
        category: 'navigation',
        shortcut: 'Ctrl+3',
        action: () => setActiveTab('Magic'),
      },
      {
        id: 'review',
        label: 'Plan Review',
        description: 'Review generated architectures and plans',
        icon: GitCompare,
        category: 'navigation',
        shortcut: 'Ctrl+4',
        action: () => setActiveTab('Review'),
      },
      {
        id: 'pipeline-view',
        label: 'Pipeline Monitor',
        description: 'View running pipelines and agent progress',
        icon: Play,
        category: 'navigation',
        shortcut: 'Ctrl+5',
        action: () => setActiveTab('Pipeline'),
      },
      {
        id: 'changes',
        label: 'View Changes',
        description: 'Review diff of applied code changes',
        icon: GitCompare,
        category: 'navigation',
        shortcut: 'Ctrl+6',
        action: () => setActiveTab('Changes'),
      },
      {
        id: 'settings',
        label: 'Open Settings',
        description: 'Configure IDE and agent preferences',
        icon: Settings,
        category: 'navigation',
        shortcut: 'Ctrl+,',
        action: () => setActiveTab('Settings'),
      },
      // Pipeline
      {
        id: 'pipeline-run',
        label: 'Run Pipeline',
        description: 'Start full pipeline on selected repos',
        icon: Play,
        category: 'pipeline',
        shortcut: 'Ctrl+Shift+R',
        action: () => startPipeline(['Nexus-Alpha']),
      },
      // View
      {
        id: 'view-toggle-sidebar',
        label: 'Toggle Sidebar',
        description: 'Show/hide left navigation',
        icon: PanelRight,
        category: 'view',
        shortcut: 'Ctrl+B',
        action: () => toggleSidebar(),
      },
      {
        id: 'view-toggle-ai',
        label: 'Toggle AI Panel',
        description: 'Show/hide right AI panel',
        icon: SplitSquareVertical,
        category: 'view',
        shortcut: 'Ctrl+Shift+A',
        action: () => toggleAiPanel(),
      },
      {
        id: 'view-toggle-terminal',
        label: 'Toggle Terminal',
        description: 'Show/hide integrated terminal',
        icon: Terminal,
        category: 'view',
        shortcut: 'Ctrl+`',
        action: () => {
          setBottomPanelActive('terminal');
        },
      },
      {
        id: 'view-overview',
        label: 'Open Dashboard Overview',
        description: 'System status and metrics',
        icon: LayoutGrid,
        category: 'view',
        shortcut: 'Ctrl+Shift+O',
        action: () => setActiveTab('Overview'),
      },
      {
        id: 'view-mission',
        label: 'Mission Control',
        description: 'Agent orchestration hub',
        icon: Monitor,
        category: 'view',
        action: () => setActiveTab('Mission Control'),
      },
      // Editor
      {
        id: 'editor-save',
        label: 'Save File',
        description: 'Save current editor file',
        icon: Save,
        category: 'editor',
        shortcut: 'Ctrl+S',
        action: () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true })),
      },
      {
        id: 'editor-copy',
        label: 'Copy All',
        description: 'Copy entire editor content',
        icon: Copy,
        category: 'editor',
        action: () => {
          document.execCommand('selectAll');
          document.execCommand('copy');
        },
      },
      {
        id: 'editor-find',
        label: 'Find in File',
        description: 'Search within current editor',
        icon: Search,
        category: 'editor',
        shortcut: 'Ctrl+F',
        action: () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true })),
      },
      {
        id: 'settings-shortcuts',
        label: 'Keyboard Shortcuts',
        description: 'View all keyboard shortcuts',
        icon: Keyboard,
        category: 'settings',
        shortcut: 'Ctrl+K Ctrl+S',
        action: () => setActiveTab('Settings'),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commandResults = allCommands().filter(
    (c) =>
      c.label.toLowerCase().includes(query.toLowerCase()) ||
      c.description?.toLowerCase().includes(query.toLowerCase()),
  );

  // Fuzzy match files
  const fileResults = files.filter((f) => {
    if (!query) return false;
    const q = query.toLowerCase();
    return f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q);
  }).slice(0, 15);

  const groupedCommands = commandResults.reduce(
    (acc, cmd) => {
      const cat = cmd.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(cmd);
      return acc;
    },
    {} as Record<string, Command[]>,
  );

  // Build flat list: files first, then commands
  const flatItems = [
    ...(fileResults.length > 0
      ? fileResults.map((f) => ({ type: 'file' as const, file: f }))
      : []),
    ...Object.values(groupedCommands)
      .flat()
      .map((cmd) => ({ type: 'command' as const, command: cmd })),
  ];

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // Ctrl+P: file search
      if (mod && e.key === 'p' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        fetchFiles();
        setIsOpen(true);
        return;
      }

      // Ctrl+K or Ctrl+Shift+P or F1: command palette
      if ((mod && e.key === 'k' && !e.shiftKey && !e.altKey) ||
          (mod && e.key === 'P' && e.shiftKey) ||
          e.key === 'F1') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      // Ctrl+`: toggle terminal
      if (mod && e.key === '`' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        setBottomPanelActive('terminal');
        return;
      }

      // Ctrl+B: toggle sidebar
      if (mod && e.key === 'b' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // Ctrl+J: toggle bottom panel
      if (mod && e.key === 'j' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        toggleBottomPanel();
        return;
      }

      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, fetchFiles, toggleSidebar, toggleBottomPanel, setBottomPanelActive]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
      fetchFiles();
    } else {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen, fetchFiles]);

  const handleSelect = useCallback(
    (item: (typeof flatItems)[0]) => {
      if (item.type === 'file') {
        // Open file in editor
        setActiveTab('Editor');
        // The EditorTab loads files via API, we navigate there
        // Store intent so EditorTab can pick it up
        sessionStorage.setItem('vibeserve_open_file', item.file.path);
        window.dispatchEvent(new CustomEvent('vibeserve:open-file', { detail: item.file.path }));
      } else {
        item.command.action();
      }
      setIsOpen(false);
    },
    [setActiveTab],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flatItems[selectedIndex];
      if (item) handleSelect(item);
    }
  };

  const categoryLabels: Record<string, string> = {
    files: 'Files',
    navigation: 'Navigate',
    editor: 'Editor',
    pipeline: 'Pipeline',
    view: 'View',
    settings: 'Settings',
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
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -30 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-[560px] z-50"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
          >
            <div className="rounded-xl overflow-hidden shadow-2xl border border-[#30363d] bg-[#161b22]">
              {/* Search input */}
              <div className="flex items-center px-4 py-1 border-b border-[#21262d]">
                <Search className="w-4 h-4 text-[#7d8590] mr-3 flex-shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search files by name, or type a command..."
                  aria-label="Search commands and files"
                  className="flex-1 bg-transparent border-none outline-none text-[#c9d1d9] text-sm py-3 placeholder:text-[#484f58]"
                />
                <kbd className="px-1.5 py-0.5 text-[10px] text-[#7d8590] font-mono border border-[#30363d] rounded bg-[#0d1117]">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-[360px] overflow-y-auto p-1 custom-scrollbar" role="listbox">
                {flatItems.length === 0 && !loadingFiles && (
                  <div className="p-8 text-center text-sm text-[#7d8590]">
                    {query ? `No results for "${query}"` : 'Type to search files or commands'}
                  </div>
                )}

                {/* File results */}
                {fileResults.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-[#7d8590] uppercase tracking-wider">
                      Files
                    </div>
                    {fileResults.map((file) => {
                      const idx = flatItems.findIndex(
                        (i) => i.type === 'file' && i.file.path === file.path,
                      );
                      return (
                        <button
                          key={file.path}
                          onClick={() => handleSelect({ type: 'file', file })}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                            idx === selectedIndex
                              ? 'bg-[#1f6feb]/20 text-[#c9d1d9]'
                              : 'text-[#c9d1d9] hover:bg-[#21262d]'
                          }`}
                          role="option"
                          aria-selected={idx === selectedIndex}
                        >
                          <FileCode
                            className={`w-4 h-4 flex-shrink-0 ${
                              idx === selectedIndex ? 'text-[#58a6ff]' : 'text-[#7d8590]'
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate">{file.name}</div>
                            <div className="text-[10px] text-[#484f58] truncate">{file.path}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Command results */}
                {commandResults.length > 0 && (
                  <>
                    {Object.entries(groupedCommands).map(([category, cmds]) => (
                      <div key={category}>
                        <div className="px-3 py-1.5 text-[10px] font-semibold text-[#7d8590] uppercase tracking-wider">
                          {categoryLabels[category] ?? category}
                        </div>
                        {cmds.map((cmd) => {
                          const globalIdx = flatItems.findIndex(
                            (i) => i.type === 'command' && i.command.id === cmd.id,
                          );
                          return (
                            <button
                              key={cmd.id}
                              onClick={() => handleSelect({ type: 'command', command: cmd })}
                              onMouseEnter={() => setSelectedIndex(globalIdx)}
                              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left group ${
                                globalIdx === selectedIndex
                                  ? 'bg-[#1f6feb]/20 text-[#c9d1d9]'
                                  : 'text-[#c9d1d9] hover:bg-[#21262d]'
                              }`}
                              role="option"
                              aria-selected={globalIdx === selectedIndex}
                            >
                              <cmd.icon
                                className={`w-4 h-4 flex-shrink-0 ${
                                  globalIdx === selectedIndex ? 'text-[#58a6ff]' : 'text-[#7d8590]'
                                }`}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm truncate">{cmd.label}</div>
                                {cmd.description && (
                                  <div className="text-[10px] text-[#7d8590] truncate">
                                    {cmd.description}
                                  </div>
                                )}
                              </div>
                              {cmd.shortcut && (
                                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-[#7d8590] font-mono bg-[#0d1117] border border-[#30363d] rounded">
                                  {cmd.shortcut}
                                </kbd>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-[#21262d] flex items-center justify-between text-[10px] text-[#7d8590]">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-[#0d1117] border border-[#30363d] rounded font-mono">
                      &#8593;&#8595;
                    </kbd>
                    navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-[#0d1117] border border-[#30363d] rounded font-mono">
                      &#8629;
                    </kbd>
                    select
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-[#0d1117] border border-[#30363d] rounded font-mono">
                      esc
                    </kbd>
                    close
                  </span>
                </div>
                <span className="font-mono text-[#58a6ff]/60">{loadingFiles ? 'Indexing...' : `${files.length} files`}</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
