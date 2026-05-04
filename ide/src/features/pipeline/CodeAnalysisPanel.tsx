/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Code2, FileCode, GitBranch, AlertTriangle, AlertCircle, Info, 
  ChevronDown, ChevronRight, Hash, Type, FunctionSquare, Box, Import
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { CodeAnalysisResult, CodeSymbol, CodeDependency } from '../../types';

interface CodeAnalysisPanelProps {
  analyses: CodeAnalysisResult[];
  onAnalyzeFile?: (filePath: string) => void;
}

const symbolIcons: Record<string, React.ReactNode> = {
  function: <FunctionSquare size={10} className="text-blue-400" />,
  class: <Box size={10} className="text-emerald-400" />,
  interface: <Type size={10} className="text-purple-400" />,
  type: <Type size={10} className="text-amber-400" />,
  variable: <Hash size={10} className="text-rose-400" />,
  constant: <Hash size={10} className="text-rose-400" />,
  import: <Import size={10} className="text-blue-400" />,
  export: <Import size={10} className="text-emerald-400" />,
};

const severityColors: Record<string, string> = {
  error: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  warning: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  info: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
};

const severityIcons: Record<string, React.ReactNode> = {
  error: <AlertCircle size={10} />,
  warning: <AlertTriangle size={10} />,
  info: <Info size={10} />,
};

export const CodeAnalysisPanel: React.FC<CodeAnalysisPanelProps> = ({
  analyses,
  onAnalyzeFile,
}) => {
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  const totalSymbols = analyses.reduce((acc, a) => acc + a.symbols.length, 0);
  const totalDeps = analyses.reduce((acc, a) => acc + a.dependencies.length, 0);
  const totalIssues = analyses.reduce((acc, a) => acc + a.issues.length, 0);

  return (
    <div className="bg-[#151619] border border-[#2d2e32] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d2e32]">
        <div className="flex items-center gap-2">
          <Code2 size={14} className="text-emerald-400" />
          <span className="text-xs font-mono text-[#8E9299] uppercase tracking-widest">
            Code Analysis
          </span>
          <span className="text-[10px] text-[#4a4b50] font-mono">
            {analyses.length} files
          </span>
        </div>
        <div className="flex items-center gap-3 text-[9px] font-mono">
          <span className="text-blue-400">{totalSymbols} symbols</span>
          <span className="text-purple-400">{totalDeps} deps</span>
          <span className={cn(totalIssues > 0 ? 'text-rose-400' : 'text-emerald-400')}>
            {totalIssues} issues
          </span>
        </div>
      </div>

      <div className="divide-y divide-[#1a1b1e] max-h-96 overflow-y-auto">
        {analyses.map((analysis, index) => {
          const isExpanded = expandedFile === analysis.filePath;

          return (
            <div key={analysis.filePath}>
              <div
                className="flex items-center justify-between px-4 py-3 hover:bg-[#1a1b1e]/50 cursor-pointer transition-colors"
                onClick={() => setExpandedFile(isExpanded ? null : analysis.filePath)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown size={14} className="text-[#4a4b50]" /> : <ChevronRight size={14} className="text-[#4a4b50]" />}
                  <FileCode size={12} className="text-emerald-400" />
                  <span className="text-xs font-mono text-[#8E9299]">
                    {analysis.filePath.split('/').pop()}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[9px] font-mono">
                  <span className="text-[#4a4b50]">{analysis.linesOfCode} LOC</span>
                  <span className={cn(
                    'px-1.5 py-0.5 rounded',
                    analysis.complexityScore > 20 ? 'bg-rose-500/10 text-rose-400' :
                    analysis.complexityScore > 10 ? 'bg-amber-500/10 text-amber-400' :
                    'bg-emerald-500/10 text-emerald-400'
                  )}>
                    {analysis.complexityScore}
                  </span>
                  {analysis.issues.length > 0 && (
                    <span className="text-rose-400 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {analysis.issues.length}
                    </span>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-[#0a0a0c] border-t border-[#1a1b1e] px-4 py-3"
                  >
                    <div className="text-[10px] font-mono text-[#4a4b50] mb-3">
                      {analysis.filePath}
                    </div>

                    {analysis.issues.length > 0 && (
                      <div className="mb-3">
                        <div className="text-[9px] font-mono text-[#4a4b50] uppercase mb-2">Issues</div>
                        <div className="space-y-1">
                          {analysis.issues.map((issue, i) => (
                            <div key={i} className={cn('flex items-center gap-2 px-2 py-1 rounded text-[9px] font-mono border', severityColors[issue.severity])}>
                              {severityIcons[issue.severity]}
                              <span>{issue.message}</span>
                              {issue.line && <span className="text-[#4a4b50]">@ L{issue.line}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {analysis.symbols.length > 0 && (
                      <div className="mb-3">
                        <div className="text-[9px] font-mono text-[#4a4b50] uppercase mb-2">Symbols ({analysis.symbols.length})</div>
                        <div className="flex flex-wrap gap-1">
                          {analysis.symbols.slice(0, 10).map((symbol, i) => (
                            <span key={i} className="flex items-center gap-1 px-1.5 py-0.5 bg-[#151619] rounded text-[8px] font-mono text-[#8E9299]">
                              {symbolIcons[symbol.type]}
                              {symbol.name}
                            </span>
                          ))}
                          {analysis.symbols.length > 10 && (
                            <span className="text-[8px] font-mono text-[#4a4b50]">
                              +{analysis.symbols.length - 10} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {analysis.dependencies.length > 0 && (
                      <div>
                        <div className="text-[9px] font-mono text-[#4a4b50] uppercase mb-2">Dependencies ({analysis.dependencies.length})</div>
                        <div className="space-y-1">
                          {analysis.dependencies.slice(0, 5).map((dep, i) => (
                            <div key={i} className="flex items-center gap-2 text-[9px] font-mono">
                              <GitBranch size={10} className="text-purple-400" />
                              <span className="text-blue-400">{dep.source}</span>
                              <span className="text-[#4a4b50]">→</span>
                              <span className="text-emerald-400">{dep.target}</span>
                            </div>
                          ))}
                          {analysis.dependencies.length > 5 && (
                            <span className="text-[8px] font-mono text-[#4a4b50]">
                              +{analysis.dependencies.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {analyses.length === 0 && (
        <div className="p-8 text-center">
          <Code2 size={24} className="text-[#4a4b50] mx-auto mb-2" />
          <p className="text-[10px] font-mono text-[#4a4b50]">No analysis results</p>
        </div>
      )}
    </div>
  );
};
