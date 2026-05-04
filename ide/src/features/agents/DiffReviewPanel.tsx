import { useState } from 'react';
import { FileDiff, Check, X, ChevronDown, ChevronRight, Plus, Minus, RefreshCw } from 'lucide-react';
import { compareFiles, type FileChange, type PlanStep } from '../../services/multi-file-planner';

interface PendingChange {
  id: string;
  files: FileChange[];
  description: string;
  timestamp: number;
  selectedFiles: Set<string>;
}

interface DiffReviewPanelProps {
  changes?: PendingChange[];
  onApply?: (change: PendingChange, selectedFiles: Set<string>) => void;
  onReject?: (changeId: string) => void;
}

export function DiffReviewPanel({ changes = [], onApply, onReject }: DiffReviewPanelProps) {
  const [expandedChanges, setExpandedChanges] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Record<string, Set<string>>>({});

  const toggleChange = (id: string) => {
    const newExpanded = new Set(expandedChanges);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedChanges(newExpanded);
  };

  const toggleFileSelection = (changeId: string, filePath: string) => {
    setSelectedFiles(prev => {
      const changeFiles = prev[changeId] || new Set<string>();
      const newFiles = new Set(changeFiles);
      if (newFiles.has(filePath)) {
        newFiles.delete(filePath);
      } else {
        newFiles.add(filePath);
      }
      return { ...prev, [changeId]: newFiles };
    });
  };

  const selectAllFiles = (changeId: string, files: FileChange[]) => {
    setSelectedFiles(prev => ({
      ...prev,
      [changeId]: new Set(files.map(f => f.path)),
    }));
  };

  const deselectAllFiles = (changeId: string) => {
    setSelectedFiles(prev => {
      const newPrev = { ...prev };
      delete newPrev[changeId];
      return newPrev;
    });
  };

  const renderDiffLine = (change: any, index: number) => {
    const isAdd = change.type === 'CREATE';
    const isRemove = change.type === 'REMOVE';
    
    return (
      <div key={index} className={`flex font-mono text-xs ${isAdd ? 'text-emerald-400 bg-emerald-900/20' : isRemove ? 'text-red-400 bg-red-900/20' : 'text-gray-300'}`}>
        <span className="w-6 text-center select-none">{isAdd ? '+' : isRemove ? '-' : '~'}</span>
        <span className="flex-1 truncate">{typeof change.value === 'string' ? change.value : JSON.stringify(change.value)}</span>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] text-gray-300">
      <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-gray-800">
        <div className="flex items-center gap-2">
          <FileDiff className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-white">Diff Review</span>
          <span className="px-1.5 py-0.5 bg-gray-700 text-xs rounded">{changes.length} pending</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {changes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileDiff className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No pending changes to review</p>
          </div>
        ) : (
          changes.map(change => (
            <div key={change.id} className="bg-[#252526] rounded-lg overflow-hidden">
              <div 
                className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[#2d2d2d]"
                onClick={() => toggleChange(change.id)}
              >
                <div className="flex items-center gap-2">
                  {expandedChanges.has(change.id) ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="text-sm text-white">{change.description}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{change.files.length} files</span>
                  {onReject && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onReject(change.id); }}
                      className="p-1 hover:bg-red-900/50 rounded"
                    >
                      <X className="w-3 h-3 text-red-400" />
                    </button>
                  )}
                </div>
              </div>

              {expandedChanges.has(change.id) && (
                <div className="px-3 pb-3 border-t border-gray-800">
                  <div className="flex items-center gap-2 py-2">
                    <button
                      onClick={() => selectAllFiles(change.id, change.files)}
                      className="text-xs text-emerald-400 hover:text-emerald-300"
                    >
                      Select All
                    </button>
                    <span className="text-gray-600">|</span>
                    <button
                      onClick={() => deselectAllFiles(change.id)}
                      className="text-xs text-gray-400 hover:text-gray-300"
                    >
                      Deselect All
                    </button>
                    <span className="text-xs text-gray-500 ml-auto">
                      {(selectedFiles[change.id]?.size || 0)} / {change.files.length} selected
                    </span>
                  </div>

                  <div className="space-y-2">
                    {change.files.map((file, idx) => {
                      const isSelected = selectedFiles[change.id]?.has(file.path) ?? true;
                      return (
                        <div key={idx} className={`border rounded ${isSelected ? 'border-emerald-700' : 'border-gray-700'}`}>
                          <div 
                            className="flex items-center justify-between px-2 py-1.5 bg-[#1e1e1e] cursor-pointer"
                            onClick={() => toggleFileSelection(change.id, file.path)}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="rounded border-gray-600"
                              />
                              <span className="text-xs text-gray-300 font-mono">{file.path}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-emerald-400 flex items-center gap-1">
                                <Plus className="w-3 h-3" />
                                {file.changes.filter(c => c.type === 'CREATE').length}
                              </span>
                              <span className="text-red-400 flex items-center gap-1">
                                <Minus className="w-3 h-3" />
                                {file.changes.filter(c => c.type === 'REMOVE').length}
                              </span>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="px-2 py-1 max-h-32 overflow-y-auto bg-[#0d0d0d]">
                              {file.changes.slice(0, 10).map((c, i) => renderDiffLine(c, i))}
                              {file.changes.length > 10 && (
                                <div className="text-xs text-gray-500 py-1">
                                  ... {file.changes.length - 10} more changes
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {onApply && (
                    <button
                      onClick={() => onApply(change, selectedFiles[change.id] || new Set(change.files.map(f => f.path)))}
                      disabled={!(selectedFiles[change.id]?.size ?? change.files.length)}
                      className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-900 text-emerald-300 rounded hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check className="w-4 h-4" />
                      Apply Selected Changes
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function useDiffReviewStore() {
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);

  const addChange = (change: Omit<PendingChange, 'id' | 'timestamp' | 'selectedFiles'>) => {
    const newChange: PendingChange = {
      ...change,
      id: `change-${Date.now()}`,
      timestamp: Date.now(),
      selectedFiles: new Set(change.files.map(f => f.path)),
    };
    setPendingChanges(prev => [...prev, newChange]);
    return newChange.id;
  };

  const removeChange = (id: string) => {
    setPendingChanges(prev => prev.filter(c => c.id !== id));
  };

  const clearChanges = () => {
    setPendingChanges([]);
  };

  return {
    pendingChanges,
    addChange,
    removeChange,
    clearChanges,
  };
}
