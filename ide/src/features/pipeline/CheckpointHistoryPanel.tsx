/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Save, RotateCcw, Clock, FileText, HardDrive, Tag, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { CheckpointSnapshot } from '../../types';

interface CheckpointHistoryPanelProps {
  checkpoints: CheckpointSnapshot[];
  onRestore?: (checkpointId: string) => void;
  onDelete?: (checkpointId: string) => void;
  currentCheckpoint?: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export const CheckpointHistoryPanel: React.FC<CheckpointHistoryPanelProps> = ({
  checkpoints,
  onRestore,
  onDelete,
  currentCheckpoint,
}) => {
  return (
    <div className="bg-[#151619] border border-[#2d2e32] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d2e32]">
        <div className="flex items-center gap-2">
          <Save size={14} className="text-amber-400" />
          <span className="text-xs font-mono text-[#8E9299] uppercase tracking-widest">
            Session Checkpoints
          </span>
          <span className="text-[10px] text-[#4a4b50] font-mono">
            ({checkpoints.length} snapshots)
          </span>
        </div>
      </div>

      <div className="divide-y divide-[#1a1b1e] max-h-96 overflow-y-auto">
        {checkpoints.map((checkpoint, index) => {
          const isCurrent = currentCheckpoint === checkpoint.id;

          return (
            <motion.div
              key={checkpoint.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                'px-4 py-3 hover:bg-[#1a1b1e]/50 transition-colors',
                isCurrent && 'bg-emerald-500/5 border-l-2 border-emerald-500'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock size={12} className="text-[#4a4b50]" />
                  <span className="text-xs font-medium text-[#8E9299]">
                    {formatTime(checkpoint.timestamp)}
                  </span>
                  {isCurrent && (
                    <span className="text-[8px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      CURRENT
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onRestore?.(checkpoint.id)}
                    className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded transition-colors"
                    title="Restore checkpoint"
                  >
                    <RotateCcw size={12} />
                  </button>
                  {!isCurrent && onDelete && (
                    <button
                      onClick={() => onDelete(checkpoint.id)}
                      className="p-1.5 text-[#4a4b50] hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                      title="Delete checkpoint"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              <div className="text-[10px] text-[#4a4b50] font-mono mb-2">
                {checkpoint.description}
              </div>

              <div className="flex items-center gap-4 text-[9px] font-mono">
                <div className="flex items-center gap-1 text-[#4a4b50]">
                  <FileText size={10} />
                  <span>{checkpoint.fileCount} files</span>
                </div>
                <div className="flex items-center gap-1 text-[#4a4b50]">
                  <HardDrive size={10} />
                  <span>{formatBytes(checkpoint.totalSize)}</span>
                </div>
                {checkpoint.tags && checkpoint.tags.length > 0 && (
                  <div className="flex items-center gap-1 text-blue-400">
                    <Tag size={10} />
                    <span>{checkpoint.tags.join(', ')}</span>
                  </div>
                )}
              </div>

              {checkpoint.files.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {checkpoint.files.slice(0, 5).map((file, i) => (
                    <span
                      key={i}
                      className="text-[8px] font-mono text-emerald-500/70 bg-emerald-500/5 px-1.5 py-0.5 rounded"
                    >
                      {file.split('/').pop()}
                    </span>
                  ))}
                  {checkpoint.files.length > 5 && (
                    <span className="text-[8px] font-mono text-[#4a4b50]">
                      +{checkpoint.files.length - 5} more
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {checkpoints.length === 0 && (
        <div className="p-8 text-center">
          <Save size={24} className="text-[#4a4b50] mx-auto mb-2" />
          <p className="text-[10px] font-mono text-[#4a4b50]">No checkpoints saved yet</p>
        </div>
      )}
    </div>
  );
};
