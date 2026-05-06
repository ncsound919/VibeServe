/**
 * InlineDiffOverlay — floating diff panel that appears over the editor
 * when applying AI-generated code changes. Cursor-style accept/reject.
 */
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, FileCode, GitCompare, AlertCircle, Loader2 } from 'lucide-react';

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'context' | 'add' | 'remove';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffChange {
  fileName: string;
  oldContent?: string;
  newContent: string;
  language: string;
  hunks: DiffHunk[];
  applied?: boolean;
  rejected?: boolean;
  verifying?: boolean;
  verified?: boolean;
  verificationStatus?: 'passing' | 'failing';
}

interface InlineDiffOverlayProps {
  changes: DiffChange[];
  visible: boolean;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onAcceptFile: (fileName: string) => void;
  onRejectFile: (fileName: string) => void;
  onClose: () => void;
}

/**
 * Compute a simple line-by-line diff between old and new content.
 */
export function computeDiff(oldContent: string, newContent: string, fileName: string): DiffHunk[] {
  const oldLines = (oldContent || '').split('\n');
  const newLines = newContent.split('\n');

  // Simple diff: if old is empty, all lines are additions
  if (!oldContent) {
    return [
      {
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: newLines.length,
        header: `@@ -0,0 +1,${newLines.length} @@`,
        lines: newLines.map((line, i) => ({
          type: 'add' as const,
          content: line,
          newLineNumber: i + 1,
        })),
      },
    ];
  }

  // Simple line-by-line comparison
  const hunks: DiffHunk[] = [];
  const maxLen = Math.max(oldLines.length, newLines.length);
  let currentHunk: DiffLine[] = [];
  let hunkOldStart = 1;
  let hunkNewStart = 1;
  let inChange = false;

  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === newLine) {
      if (inChange && currentHunk.length > 0) {
        // Close current hunk
        const adds = currentHunk.filter((l) => l.type === 'add').length;
        const rems = currentHunk.filter((l) => l.type === 'remove').length;
        hunks.push({
          oldStart: hunkOldStart,
          oldLines: rems + (currentHunk.length - adds - rems),
          newStart: hunkNewStart,
          newLines: adds + (currentHunk.length - adds - rems),
          header: `@@ -${hunkOldStart},${rems || 1} +${hunkNewStart},${adds || 1} @@`,
          lines: currentHunk,
        });
        currentHunk = [];
        inChange = false;
      }
    } else {
      if (!inChange) {
        hunkOldStart = i + 1;
        hunkNewStart = i + 1;
        inChange = true;
      }
      if (oldLine !== undefined) {
        currentHunk.push({
          type: 'remove',
          content: oldLine,
          oldLineNumber: i + 1,
        });
      }
      if (newLine !== undefined) {
        currentHunk.push({
          type: 'add',
          content: newLine,
          newLineNumber: i + 1,
        });
      }
    }
  }

  // Close any remaining hunk
  if (inChange && currentHunk.length > 0) {
    const adds = currentHunk.filter((l) => l.type === 'add').length;
    const rems = currentHunk.filter((l) => l.type === 'remove').length;
    hunks.push({
      oldStart: hunkOldStart,
      oldLines: rems || 1,
      newStart: hunkNewStart,
      newLines: adds || 1,
      header: `@@ -${hunkOldStart},${rems || 1} +${hunkNewStart},${adds || 1} @@`,
      lines: currentHunk,
    });
  }

  return hunks;
}

export function InlineDiffOverlay({
  changes,
  visible,
  onAcceptAll,
  onRejectAll,
  onAcceptFile,
  onRejectFile,
  onClose,
}: InlineDiffOverlayProps) {
  const [selectedFile, setSelectedFile] = useState<string>(changes[0]?.fileName || '');

  const activeChange = changes.find((c) => c.fileName === selectedFile);

  const stats = {
    total: changes.length,
    applied: changes.filter((c) => c.applied).length,
    rejected: changes.filter((c) => c.rejected).length,
    pending: changes.filter((c) => !c.applied && !c.rejected).length,
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.stopPropagation()}
          className="w-[90vw] max-w-[900px] h-[80vh] max-h-[700px] bg-[#0d1117] border border-[#30363d] rounded-xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#21262d] bg-[#161b22]">
            <div className="flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-[#58a6ff]" />
              <span className="text-sm font-semibold text-[#c9d1d9]">Review Changes</span>
              <span className="text-xs text-[#7d8590]">
                ({stats.total} file{stats.total !== 1 ? 's' : ''})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-3 text-xs text-[#7d8590] mr-2">
                {stats.pending > 0 && <span>{stats.pending} pending</span>}
                {stats.applied > 0 && <span className="text-[#3fb950]">{stats.applied} applied</span>}
                {stats.rejected > 0 && <span className="text-[#f85149]">{stats.rejected} rejected</span>}
              </div>
              <button
                onClick={onAcceptAll}
                disabled={stats.pending === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#2ea043]/10 text-[#3fb950] border border-[#2ea043]/20 hover:bg-[#2ea043]/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Check className="w-3 h-3" />
                Accept All
              </button>
              <button
                onClick={onRejectAll}
                disabled={stats.pending === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#f85149]/10 text-[#f85149] border border-[#f85149]/20 hover:bg-[#f85149]/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <X className="w-3 h-3" />
                Reject All
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-[#21262d] text-[#7d8590] hover:text-[#c9d1d9] transition-colors ml-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-1 min-h-0">
            {/* File list */}
            <div className="w-56 border-r border-[#21262d] bg-[#0d1117]/50 overflow-y-auto">
              <div className="p-2 space-y-0.5">
                {changes.map((change) => (
                  <button
                    key={change.fileName}
                    onClick={() => setSelectedFile(change.fileName)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                      selectedFile === change.fileName
                        ? 'bg-[#1f6feb]/10 text-[#58a6ff] border border-[#1f6feb]/20'
                        : 'text-[#c9d1d9] hover:bg-[#21262d]'
                    }`}
                  >
                    {change.verifying ? (
                      <Loader2 className="w-3 h-3 text-[#d29922] animate-spin flex-shrink-0" />
                    ) : change.applied ? (
                      <Check className="w-3 h-3 text-[#3fb950] flex-shrink-0" />
                    ) : change.rejected ? (
                      <X className="w-3 h-3 text-[#f85149] flex-shrink-0" />
                    ) : (
                      <FileCode className="w-3 h-3 text-[#7d8590] flex-shrink-0" />
                    )}
                    <span className="truncate">{change.fileName.split('/').pop()}</span>
                    {change.verificationStatus === 'passing' && (
                      <Check className="w-3 h-3 text-[#3fb950] ml-auto flex-shrink-0" />
                    )}
                    {change.verificationStatus === 'failing' && (
                      <AlertCircle className="w-3 h-3 text-[#f85149] ml-auto flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Diff view */}
            <div className="flex-1 flex flex-col min-h-0">
              {activeChange && (
                <>
                  {/* File header */}
                  <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#21262d]">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-[#7d8590]" />
                      <span className="text-sm font-mono text-[#c9d1d9]">{activeChange.fileName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onAcceptFile(activeChange.fileName)}
                        disabled={activeChange.applied || activeChange.rejected}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-[#2ea043]/10 text-[#3fb950] border border-[#2ea043]/20 hover:bg-[#2ea043]/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Check className="w-3 h-3" />
                        Accept
                      </button>
                      <button
                        onClick={() => onRejectFile(activeChange.fileName)}
                        disabled={activeChange.applied || activeChange.rejected}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-[#f85149]/10 text-[#f85149] border border-[#f85149]/20 hover:bg-[#f85149]/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <X className="w-3 h-3" />
                        Reject
                      </button>
                    </div>
                  </div>

                  {/* Hunks */}
                  <div className="flex-1 overflow-y-auto font-mono text-xs">
                    {activeChange.hunks.map((hunk, hi) => (
                      <div key={hi} className="border-b border-[#21262d]/50">
                        {/* Hunk header */}
                        <div className="px-4 py-1 bg-[#161b22]/50 text-[10px] text-[#58a6ff]/70">
                          {hunk.header}
                        </div>
                        {/* Lines */}
                        {hunk.lines.map((line, li) => (
                          <div
                            key={li}
                            className={`flex ${
                              line.type === 'add'
                                ? 'bg-[#2ea043]/10'
                                : line.type === 'remove'
                                  ? 'bg-[#f85149]/10'
                                  : ''
                            }`}
                          >
                            {/* Line numbers */}
                            <span className="w-10 px-2 py-0.5 text-right text-[#484f58] select-none border-r border-[#21262d] flex-shrink-0">
                              {line.oldLineNumber || ''}
                            </span>
                            <span className="w-10 px-2 py-0.5 text-right text-[#484f58] select-none border-r border-[#21262d] flex-shrink-0">
                              {line.newLineNumber || ''}
                            </span>
                            {/* Indicator */}
                            <span className="w-5 px-1 py-0.5 text-center flex-shrink-0">
                              {line.type === 'add' && (
                                <span className="text-[#3fb950]">+</span>
                              )}
                              {line.type === 'remove' && (
                                <span className="text-[#f85149]">-</span>
                              )}
                            </span>
                            {/* Content */}
                            <span
                              className={`flex-1 px-2 py-0.5 whitespace-pre ${
                                line.type === 'add'
                                  ? 'text-[#7ee787]'
                                  : line.type === 'remove'
                                    ? 'text-[#ffa198]'
                                    : 'text-[#c9d1d9]'
                              }`}
                            >
                              {line.content}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-2 border-t border-[#21262d] bg-[#161b22] flex items-center justify-between text-[10px] text-[#484f58]">
                    <span>{activeChange.hunks.length} hunk{activeChange.hunks.length !== 1 ? 's' : ''}</span>
                    <span>
                      {activeChange.hunks.reduce((acc, h) => acc + h.lines.filter((l) => l.type === 'add').length, 0)}{' '}
                      additions,{' '}
                      {activeChange.hunks.reduce(
                        (acc, h) => acc + h.lines.filter((l) => l.type === 'remove').length,
                        0,
                      )}{' '}
                      deletions
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
