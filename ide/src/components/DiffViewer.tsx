import { useState } from 'react';
import { motion } from 'motion/react';
import { GitCompare, Plus, Minus, RefreshCw, Check, X, FileCode } from 'lucide-react';

interface DiffFile {
  filename: string;
  status: 'added' | 'modified' | 'deleted';
  hunks: DiffHunk[];
}

interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

interface DiffLine {
  type: 'context' | 'add' | 'remove';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

const mockDiff: DiffFile[] = [
  {
    filename: 'src/components/App.tsx',
    status: 'modified',
    hunks: [
      {
        oldStart: 10,
        oldLines: 5,
        newStart: 10,
        newLines: 7,
        lines: [
          { type: 'context', content: '  const {', oldLineNumber: 10, newLineNumber: 10 },
          { type: 'context', content: '    data,', oldLineNumber: 11, newLineNumber: 11 },
          { type: 'add', content: '    loading,', oldLineNumber: undefined, newLineNumber: 12 },
          { type: 'add', content: '    latency,', oldLineNumber: undefined, newLineNumber: 13 },
          { type: 'context', content: '    appLicensed,', oldLineNumber: 12, newLineNumber: 14 },
          { type: 'remove', content: '    // removed comment', oldLineNumber: 13, newLineNumber: undefined },
          { type: 'context', content: '  } = useNexusApp();', oldLineNumber: 14, newLineNumber: 15 },
        ],
      },
    ],
  },
  {
    filename: 'src/stores/useSettingsStore.ts',
    status: 'added',
    hunks: [
      {
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: 5,
        lines: [
          { type: 'add', content: 'import { create } from "zustand";', oldLineNumber: undefined, newLineNumber: 1 },
          { type: 'add', content: '', oldLineNumber: undefined, newLineNumber: 2 },
          { type: 'add', content: 'interface SettingsStore {', oldLineNumber: undefined, newLineNumber: 3 },
          { type: 'add', content: '  localFirstMode: boolean;', oldLineNumber: undefined, newLineNumber: 4 },
          { type: 'add', content: '}', oldLineNumber: undefined, newLineNumber: 5 },
        ],
      },
    ],
  },
  {
    filename: 'src/views/OldTab.tsx',
    status: 'deleted',
    hunks: [
      {
        oldStart: 1,
        oldLines: 20,
        newStart: 0,
        newLines: 0,
        lines: [
          { type: 'remove', content: 'export default function OldTab() {', oldLineNumber: 1, newLineNumber: undefined },
          { type: 'remove', content: '  return <div>Old Content</div>;', oldLineNumber: 2, newLineNumber: undefined },
          { type: 'remove', content: '}', oldLineNumber: 3, newLineNumber: undefined },
        ],
      },
    ],
  },
];

interface DiffViewerProps {
  diff?: DiffFile[];
  onAccept?: (file: string) => void;
  onReject?: (file: string) => void;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
}

export function DiffViewer({ diff = mockDiff, onAccept, onReject, onAcceptAll, onRejectAll }: DiffViewerProps) {
  const [selectedFile, setSelectedFile] = useState<string>(diff[0]?.filename || '');
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());

  const activeFile = diff.find(f => f.filename === selectedFile);

  const toggleFile = (filename: string) => {
    const newCollapsed = new Set(collapsedFiles);
    if (newCollapsed.has(filename)) {
      newCollapsed.delete(filename);
    } else {
      newCollapsed.add(filename);
    }
    setCollapsedFiles(newCollapsed);
  };

  const getStatusIcon = (status: DiffFile['status']) => {
    switch (status) {
      case 'added': return <Plus className="w-3 h-3 text-emerald-400" />;
      case 'deleted': return <Minus className="w-3 h-3 text-red-400" />;
      case 'modified': return <GitCompare className="w-3 h-3 text-amber-400" />;
    }
  };

  const getStatusBadge = (status: DiffFile['status']) => {
    switch (status) {
      case 'added': return 'bg-emerald-500/20 text-emerald-400';
      case 'deleted': return 'bg-red-500/20 text-red-400';
      case 'modified': return 'bg-amber-500/20 text-amber-400';
    }
  };

  const stats = {
    added: diff.filter(f => f.status === 'added').length,
    modified: diff.filter(f => f.status === 'modified').length,
    deleted: diff.filter(f => f.status === 'deleted').length,
  };

  return (
    <div className="flex flex-col h-full bg-[#0A0A0B] border border-gray-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#111113]">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-medium text-white">Changes Review</span>
          <span className="text-xs text-gray-500">({diff.length} files)</span>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-emerald-400">+{stats.added} added</span>
            <span className="text-amber-400">~{stats.modified} modified</span>
            <span className="text-red-400">-{stats.deleted} deleted</span>
          </div>
          <button
            onClick={onAcceptAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded transition-colors"
          >
            <Check className="w-3 h-3" />
            Accept All
          </button>
          <button
            onClick={onRejectAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors"
          >
            <X className="w-3 h-3" />
            Reject All
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-64 border-r border-gray-800 bg-[#0f0f11] overflow-y-auto">
          <div className="p-2 space-y-1">
            {diff.map(file => (
              <button
                key={file.filename}
                onClick={() => setSelectedFile(file.filename)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                  selectedFile === file.filename
                    ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {getStatusIcon(file.status)}
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{file.filename.split('/').pop()}</div>
                  <div className="text-xs text-gray-500 truncate">{file.filename}</div>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${getStatusBadge(file.status)}`}>
                  {file.status}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {activeFile && (
            <div className="flex-1 overflow-auto">
              <div className="sticky top-0 px-4 py-2 bg-[#1a1a1c] border-b border-gray-800 flex items-center gap-2">
                <FileCode className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-white">{activeFile.filename}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${getStatusBadge(activeFile.status)}`}>
                  {activeFile.status}
                </span>
              </div>

              {activeFile.hunks.map((hunk, hunkIndex) => (
                <div key={hunkIndex} className="border-b border-gray-800/50">
                  <div className="px-4 py-1.5 bg-gray-900/50 text-xs text-gray-500 font-mono">
                    @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                  </div>
                  {hunk.lines.map((line, lineIndex) => (
                    <motion.div
                      key={lineIndex}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: lineIndex * 0.01 }}
                      className={`flex font-mono text-sm ${
                        line.type === 'add' ? 'bg-emerald-500/10' :
                        line.type === 'remove' ? 'bg-red-500/10' :
                        'bg-transparent'
                      }`}
                    >
                      <span className="w-12 px-2 py-0.5 text-right text-gray-600 select-none border-r border-gray-800">
                        {line.oldLineNumber || ''}
                      </span>
                      <span className="w-12 px-2 py-0.5 text-right text-gray-600 select-none border-r border-gray-800">
                        {line.newLineNumber || ''}
                      </span>
                      <span className="w-6 px-2 py-0.5 text-center select-none">
                        {line.type === 'add' && <Plus className="w-3 h-3 text-emerald-400" />}
                        {line.type === 'remove' && <Minus className="w-3 h-3 text-red-400" />}
                        {line.type === 'context' && <span className="text-gray-700"> </span>}
                      </span>
                      <span className={`flex-1 px-2 py-0.5 ${
                        line.type === 'add' ? 'text-emerald-300' :
                        line.type === 'remove' ? 'text-red-300' :
                        'text-gray-400'
                      }`}>
                        {line.content}
                      </span>
                    </motion.div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="w-48 border-l border-gray-800 bg-[#0f0f11] p-4">
          <div className="text-xs text-gray-500 mb-3">Actions</div>
          <div className="space-y-2">
            <button
              onClick={() => activeFile && onAccept?.(activeFile.filename)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded transition-colors"
            >
              <Check className="w-3 h-3" />
              Accept File
            </button>
            <button
              onClick={() => activeFile && onReject?.(activeFile.filename)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors"
            >
              <X className="w-3 h-3" />
              Reject File
            </button>
          </div>

          <div className="mt-6 text-xs text-gray-500 mb-3">Summary</div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-gray-400">
              <span>Hunks</span>
              <span>{activeFile?.hunks.length || 0}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Additions</span>
              <span className="text-emerald-400">
                {activeFile?.hunks.reduce((acc, h) => acc + h.lines.filter(l => l.type === 'add').length, 0) || 0}
              </span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Deletions</span>
              <span className="text-red-400">
                {activeFile?.hunks.reduce((acc, h) => acc + h.lines.filter(l => l.type === 'remove').length, 0) || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
