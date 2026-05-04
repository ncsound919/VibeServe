import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CodeEditor } from '../components/CodeEditor';
import { 
  FileCode, 
  FolderOpen, 
  Plus, 
  Search, 
  ChevronRight, 
  ChevronDown, 
  Box,
  RefreshCw,
  HardDrive
} from 'lucide-react';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: FileNode[];
}

interface AppInfo {
  id: string;
  path: string;
  createdAt: string;
}

export default function EditorTab() {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [activeContent, setActiveContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchApps();
  }, []);

  const fetchApps = async () => {
    try {
      const res = await fetch('/api/editor/list');
      const data = await res.json();
      if (data.apps) {
        setApps(data.apps);
        if (data.apps.length > 0 && !selectedAppId) {
          handleSelectApp(data.apps[data.apps.length - 1].id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch apps', e);
    }
  };

  const handleSelectApp = async (id: string) => {
    setSelectedAppId(id);
    setLoading(true);
    try {
      const res = await fetch(`/api/editor/tree/${id}`);
      const data = await res.json();
      if (data.tree) {
        setFileTree(data.tree);
        setActiveFilePath(null);
        setActiveContent(null);
      }
    } catch (e) {
      console.error('Failed to fetch tree', e);
    } finally {
      setLoading(false);
    }
  };

  const handleFileClick = async (filePath: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/editor/file?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      if (data.content !== undefined) {
        setActiveFilePath(filePath);
        setActiveContent(data.content);
      }
    } catch (e) {
      console.error('Failed to read file', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (content: string) => {
    if (!activeFilePath) return;
    try {
      const res = await fetch('/api/editor/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: activeFilePath, content })
      });
      if (res.ok) {
        setActiveContent(content);
      }
    } catch (e) {
      console.error('Failed to save file', e);
    }
  };

  const toggleDir = (path: string) => {
    setExpandedDirs(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const renderTree = (nodes: FileNode[], level = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedDirs[node.path];
      const isSelected = activeFilePath === node.path;

      if (node.type === 'dir') {
        return (
          <div key={node.path}>
            <button
              onClick={() => toggleDir(node.path)}
              className="w-full flex items-center gap-1 px-2 py-1 hover:bg-white/5 rounded text-sm text-gray-400"
              style={{ paddingLeft: `${level * 12 + 8}px` }}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <FolderOpen size={14} className="text-indigo-400/70" />
              <span className="truncate">{node.name}</span>
            </button>
            {isExpanded && node.children && renderTree(node.children, level + 1)}
          </div>
        );
      }

      return (
        <button
          key={node.path}
          onClick={() => handleFileClick(node.path)}
          className={`w-full flex items-center gap-2 px-2 py-1 rounded text-sm text-left transition-colors ${
            isSelected ? 'bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:bg-white/5 hover:text-white'
          }`}
          style={{ paddingLeft: `${level * 12 + 24}px` }}
        >
          <FileCode size={14} className={isSelected ? 'text-indigo-400' : 'text-gray-500'} />
          <span className="truncate">{node.name}</span>
        </button>
      );
    });
  };

  return (
    <div className="flex h-[calc(100vh-140px)] border border-white/5 rounded-2xl overflow-hidden bg-[#0A0A0B]">
      {/* Sidebar: App Selector + File Tree */}
      <div className="w-64 border-r border-white/5 flex flex-col bg-[#0D0D0E]">
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <HardDrive size={16} className="text-indigo-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-white">Project Registry</span>
            </div>
            <button onClick={fetchApps} className="p-1 hover:bg-white/5 rounded text-gray-500 hover:text-indigo-400 transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          
          <select 
            value={selectedAppId || ''} 
            onChange={(e) => handleSelectApp(e.target.value)}
            className="w-full bg-[#151517] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none focus:border-indigo-500/50"
          >
            {apps.length === 0 && <option>No apps found</option>}
            {apps.map(app => (
              <option key={app.id} value={app.id}>{app.id}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {loading && !fileTree.length ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 opacity-50">
              <div className="w-4 h-4 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
              <span className="text-[10px] font-mono text-gray-500">Indexing...</span>
            </div>
          ) : (
            <div className="space-y-0.5">
              {renderTree(fileTree)}
            </div>
          )}
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0F0F11]">
        <div className="h-10 flex items-center bg-[#0D0D0E] border-b border-white/5 px-4">
          {activeFilePath ? (
            <div className="flex items-center gap-2">
              <FileCode size={14} className="text-indigo-400" />
              <span className="text-xs font-mono text-gray-300">{activeFilePath}</span>
            </div>
          ) : (
            <span className="text-xs font-mono text-gray-600">No file active</span>
          )}
        </div>

        <div className="flex-1 relative">
          <AnimatePresence mode="wait">
            {activeContent !== null ? (
              <motion.div
                key={activeFilePath}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0"
              >
                <CodeEditor
                  initialValue={activeContent}
                  language={activeFilePath?.split('.').pop() || 'typescript'}
                  onSave={handleSave}
                />
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full opacity-30 select-none">
                <Box size={48} className="text-indigo-500 mb-4" />
                <p className="text-sm font-mono uppercase tracking-[0.2em] text-indigo-300">Select an artifact to edit</p>
                <p className="text-[10px] mt-2 text-gray-500">All writes are strictly guarded by Nexus RBAC</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
