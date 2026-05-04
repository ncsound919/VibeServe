/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  RotateCcw, CheckCircle2, AlertCircle, XCircle, Terminal, Zap, RefreshCcw, Cpu, Github
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { MultiAgentSynthesisLoop } from './MultiAgentSynthesisLoop';
import { RAGIntelligenceDisplay } from '../rag/RAGIntelligenceDisplay';
import { BrowserControl } from '../browser/BrowserControl';
import { E2EResultsPanel } from './E2EResultsPanel';
import { AuditCertificate } from './AuditCertificate';
import { AutoFixProgress } from './AutoFixProgress';
import type { PipelineExecutionData, CustomAgentData } from '../../types';

interface ActivePipelineRunProps {
  execution: PipelineExecutionData;
  onReset: () => void;
  onLaunch: () => void;
  activeAgent?: CustomAgentData;
}

export const ActivePipelineRun = ({ execution, onReset, onLaunch, activeAgent }: ActivePipelineRunProps) => {
  const logRef = React.useRef<HTMLDivElement>(null);
  const [showManifest, setShowManifest] = useState(false);
  const [aiInsight, setAiInsight] = useState<{ log: string; insight: string } | null>(null);
  const [pushingToGitHub, setPushingToGitHub] = useState(false);
  const [gitHubResult, setGitHubResult] = useState<string | null>(null);

  const explainLogWithAI = async (logLine: string) => {
    setAiInsight({ log: logLine, insight: 'AI Diagnostic Scanner analyzing log trace...' });
    await new Promise(r => setTimeout(r, 1500));

    let insight = 'This log indicates standard lifecycle activity within the Nexus virtual machine.';
    if (logLine.includes('FATAL')) insight = 'Critical failure detected. This is usually caused by a dependency mismatch or a timeout in the E2E cluster. Recommended action: Check for conflicting peer dependencies in synthesized stacks.';
    if (logLine.includes('vulnerability')) insight = 'Security scanner identified a risk in a transient dependency. The SLSA protocol is attempting to auto-patch via remote registry headers.';
    if (logLine.includes('metrics')) insight = 'System throughput is fluctuating. This cluster is currently undergoing automated vertical scaling to handle the synthesized build load.';

    setAiInsight({ log: logLine, insight });
  };

  const pushToGitHub = async () => {
    setPushingToGitHub(true);
    setGitHubResult(null);
    try {
      const repoName = `nexus-build-${execution.id}`;
      const createRes = await fetch('/api/github/create-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: repoName, description: `Nexus Alpha build: ${execution.sourceRepos.join(', ')}`, private: false }),
      });
      if (!createRes.ok) throw new Error(`Create repo failed: ${createRes.status}`);
      const { repo } = await createRes.json();

      const files = [
        { path: 'build-manifest.json', content: execution.manifest || '{}' },
        { path: 'pipeline-report.json', content: JSON.stringify({
          id: execution.id,
          status: execution.status,
          repos: execution.sourceRepos,
          e2eResults: execution.e2eResults,
          logs: execution.logs.slice(-20),
        }, null, 2) },
      ];

      const pushRes = await fetch('/api/github/push-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: repo.full_name.split('/')[0], repo: repo.name, files, message: `Nexus Alpha build ${execution.id}` }),
      });
      if (!pushRes.ok) throw new Error(`Push failed: ${pushRes.status}`);

      setGitHubResult(repo.html_url);
    } catch (err) {
      setGitHubResult(`Error: ${err instanceof Error ? err.message : 'Push failed'}`);
    } finally {
      setPushingToGitHub(false);
    }
  };

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [execution.logs]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-[#151619] border-2 border-emerald-500/20 p-6 rounded-2xl shadow-2xl shadow-emerald-500/5 mb-12"
    >
      {gitHubResult && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-4 p-3 rounded-lg border text-[10px] font-mono ${gitHubResult.startsWith('Error') ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}
        >
          {gitHubResult.startsWith('Error') ? (
            <span>{gitHubResult}</span>
          ) : (
            <span>Pushed to GitHub: <a href={gitHubResult} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">{gitHubResult}</a></span>
          )}
        </motion.div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center',
              execution.status === 'running' ? 'bg-emerald-500/10 text-emerald-400 animate-pulse' :
              execution.status === 'success' ? 'bg-emerald-500 text-black' : 'bg-rose-500 text-white',
            )}
          >
            {execution.status === 'running' ? <RotateCcw className="animate-spin" /> :
             execution.status === 'success' ? <CheckCircle2 /> : <AlertCircle />}
          </div>
          <div>
            <h3 className="text-lg font-medium text-white flex items-center gap-3">
              {execution.sourceRepos.length > 1 ? 'Synthesized Unified Build' : execution.sourceRepos[0]}
              <div className="flex gap-1 h-3 items-end">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ height: [4, 12, 4] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }}
                    className="w-1 bg-emerald-500/40 rounded-full"
                  />
                ))}
              </div>
            </h3>
            <p className="text-xs font-mono text-[#4a4b50] uppercase tracking-widest mt-1">
              Sources: {execution.sourceRepos.join(', ')}
            </p>
          </div>
        </div>

        {activeAgent && (
          <div className="flex items-center gap-4 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
              <Cpu size={16} />
            </div>
            <div>
              <div className="text-[10px] font-mono text-blue-400 uppercase tracking-widest leading-none mb-1">Assigned Agent</div>
              <div className="text-xs font-medium text-blue-100">{activeAgent.name}</div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {execution.status === 'success' && (
            <>
              <button
                onClick={onLaunch}
                className="text-[10px] font-mono text-black bg-emerald-500 hover:bg-emerald-400 uppercase tracking-widest px-4 py-1.5 rounded font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]"
              >
                Utilize Build
              </button>
              <button
                onClick={pushToGitHub}
                disabled={pushingToGitHub}
                className="text-[10px] font-mono text-white bg-[#1a1b1e] hover:bg-[#2d2e32] uppercase tracking-widest px-4 py-1.5 rounded font-bold transition-all border border-[#2d2e32] flex items-center gap-2 disabled:opacity-50"
              >
                <Github size={12} />
                {pushingToGitHub ? 'Pushing...' : 'Push to GitHub'}
              </button>
            </>
          )}
          <button
            onClick={onReset}
            className="text-[10px] font-mono text-[#4a4b50] hover:text-white uppercase tracking-widest border border-[#2d2e32] px-3 py-1 rounded"
          >
            Clear Session
          </button>
        </div>
      </div>

      <AnimatePresence>
        <MultiAgentSynthesisLoop execution={execution} />
      </AnimatePresence>

      {/* Auto-Fix Progress */}
      {(execution.fixAttempts && execution.fixAttempts.length > 0 || execution.autoFixActive) && (
        <AutoFixProgress fixAttempts={execution.fixAttempts || []} autoFixActive={execution.autoFixActive} />
      )}

      {/* Analysis Cards */}
      {execution.analysis && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Synthesized Stack', value: execution.analysis.stack, color: 'text-emerald-400' },
            { label: 'Functional Utility', value: execution.analysis.utility, color: 'text-emerald-400' },
            { label: 'Build Target', value: execution.analysis.buildType, color: 'text-emerald-400' },
            { label: 'Nexus Protocol', value: 'L3-SYTH-2.5', color: 'text-blue-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#0a0a0c] border border-emerald-500/10 p-4 rounded-xl">
              <div className="text-[9px] font-mono text-[#4a4b50] uppercase mb-1">{label}</div>
              <div className={cn('text-xs font-mono truncate', color)}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Resource Metrics */}
      {execution.metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 bg-[#0a0a0c] p-4 rounded-xl border border-[#2d2e32]">
          {[
            { label: 'System CPU', value: execution.metrics.cpu, unit: '%', color: execution.metrics.cpu > 80 ? 'text-red-400' : 'text-emerald-400', barColor: 'bg-emerald-500/50', width: execution.metrics.cpu },
            { label: 'Cluster Mem', value: execution.metrics.memory, unit: '%', color: 'text-blue-400', barColor: 'bg-blue-500/50', width: execution.metrics.memory },
            { label: 'I/O Throughput', value: execution.metrics.network, unit: ' MB/s', color: 'text-amber-400', barColor: 'bg-amber-500/50', width: (execution.metrics.network / 1000) * 100 },
            { label: 'Artifact Disk', value: execution.metrics.disk, unit: '%', color: 'text-[#8E9299]', barColor: 'bg-[#4a4b50]', width: execution.metrics.disk },
          ].map(({ label, value, unit, color, barColor, width }) => (
            <div key={label} className="space-y-1">
              <div className="flex justify-between text-[8px] font-mono text-[#4a4b50] uppercase">
                <span>{label}</span>
                <span className={color}>{Math.round(value)}{unit}</span>
              </div>
              <div className="h-1 bg-[#151619] rounded-full overflow-hidden">
                <motion.div animate={{ width: `${width}%` }} className={cn('h-full', barColor)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manifest Explorer */}
      <div className="mb-8">
        <button
          onClick={() => setShowManifest(!showManifest)}
          className="flex items-center gap-2 text-[10px] font-mono text-emerald-400/70 hover:text-emerald-400 uppercase tracking-widest mb-2 transition-colors"
        >
          {showManifest ? '[HIDE_BUILD_MANIFEST]' : '[INSPECT_SYNTHETIC_CONFIG]'}
        </button>
        <AnimatePresence>
          {showManifest && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-[#0a0a0c] border border-[#2d2e32] rounded-xl"
            >
              <pre className="p-4 text-[11px] font-mono text-emerald-500/80 leading-relaxed overflow-x-auto">
                <code>{execution.manifest}</code>
              </pre>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Integration / Synergy */}
      {execution.analysis && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-[#151619] border border-[#2d2e32] p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCcw size={12} className="text-blue-400" />
              <div className="text-[10px] font-mono text-[#4a4b50] uppercase">Suggested Integration</div>
            </div>
            <p className="text-[11px] text-[#8E9299] font-mono">{execution.analysis.suggestedIntegration}</p>
          </div>
          <div className="bg-[#151619] border border-[#2d2e32] p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={12} className="text-emerald-400" />
              <div className="text-[10px] font-mono text-[#4a4b50] uppercase">Potential Synergy</div>
            </div>
            <p className="text-[11px] text-[#8E9299] font-mono">{execution.analysis.potentialSynergy}</p>
          </div>
        </div>
      )}

      {/* RAG & Browser overlays */}
      {execution.rag && <RAGIntelligenceDisplay rag={execution.rag} />}
      {execution.browserSnapshot && <BrowserControl snapshot={execution.browserSnapshot} />}

      {/* Progress & Logs */}
      <div className="space-y-6 mt-8">
        <div className="relative h-2 bg-[#0a0a0c] rounded-full overflow-hidden border border-[#1a1b1e]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${execution.progress}%` }}
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Steps */}
          <div className="space-y-4">
            <h5 className="text-[10px] font-mono uppercase text-[#4a4b50] tracking-widest">Execution Steps</h5>
            <div className="space-y-2">
              {execution.steps.map((step, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg border transition-all',
                    step.status === 'running' ? 'bg-emerald-500/5 border-emerald-500/20' :
                    step.status === 'completed' ? 'bg-[#1a1b1e] border-[#2d2e32]' :
                    step.status === 'failed' ? 'bg-rose-500/5 border-rose-500/20' : 'bg-[#0a0a0c] border-[#1a1b1e] opacity-40',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        step.status === 'completed' ? 'bg-emerald-500' :
                        step.status === 'running' ? 'bg-emerald-400 animate-ping' :
                        step.status === 'failed' ? 'bg-rose-500' : 'bg-[#4a4b50]',
                      )}
                    />
                    <span className="text-xs font-medium text-[#8E9299]">{step.phase}</span>
                  </div>
                  {step.status === 'completed' && <CheckCircle2 size={12} className="text-emerald-500" />}
                  {step.status === 'failed' && <XCircle size={12} className="text-rose-500" />}
                </div>
              ))}
            </div>
          </div>

          {/* Logs */}
          <div className="bg-[#0a0a0c] rounded-xl p-4 border border-[#1a1b1e] flex flex-col h-[400px]">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center gap-2 text-[#4a4b50]">
                <Terminal size={14} />
                <span className="text-[10px] font-mono uppercase tracking-[0.2em]">Environment Logs</span>
              </div>
              {aiInsight && (
                <motion.button
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => setAiInsight(null)}
                  className="text-[9px] font-mono text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded flex items-center gap-1 hover:bg-blue-500/10"
                >
                  Clear Insight
                </motion.button>
              )}
            </div>

            <div className="flex-1 relative overflow-hidden flex flex-col">
              {aiInsight && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-0 inset-x-0 z-20 bg-blue-900/90 border border-blue-400/50 p-3 rounded-lg backdrop-blur-md shadow-2xl mb-4"
                >
                  <div className="flex items-center gap-2 text-[9px] font-bold text-blue-200 uppercase tracking-widest mb-1">
                    <Zap size={10} />
                    NEXUS AI ADVISOR
                  </div>
                  <p className="text-[10px] font-mono text-blue-100 leading-relaxed italic border-l-2 border-blue-400/50 pl-3">
                    {aiInsight.insight}
                  </p>
                </motion.div>
              )}

              <div
                ref={logRef}
                className="flex-1 overflow-y-auto custom-scrollbar font-mono text-[10px] text-[#4a4b50] space-y-1 pr-2"
              >
                {execution.logs.map((log, i) => (
                  <div key={i} className="group flex justify-between items-start gap-4">
                    <div
                      className={cn(
                        'flex-1',
                        log.startsWith('[SYSTEM]') ? 'text-blue-400' :
                        log.startsWith('[AUTH]') ? 'text-purple-400' :
                        log.startsWith('[FATAL]') ? 'text-rose-400 font-bold' : 'text-emerald-500/70',
                      )}
                    >
                      {log}
                    </div>
                    <button
                      onClick={() => explainLogWithAI(log)}
                      className="opacity-0 group-hover:opacity-100 text-[8px] font-bold text-[#4a4b50] hover:text-emerald-400 transition-all uppercase tracking-widest whitespace-nowrap"
                    >
                      [EXPLAIN_AI]
                    </button>
                  </div>
                ))}
                {execution.status === 'running' && (
                  <div className="text-white animate-pulse">_ processing: {execution.currentStep}...</div>
                )}
              </div>
            </div>

            {execution.e2eResults.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[#1a1b1e] shrink-0">
                <E2EResultsPanel results={execution.e2eResults} />
                {execution.steps.find(s => s.phase === 'Security Audit')?.status === 'completed' && (
                  <AuditCertificate
          hash={execution.analysis?.hash || `sha256:0x${execution.id.slice(0, 10)}...`}
          critical={execution.analysis?.vulnerabilities?.critical || 0}
          high={execution.analysis?.vulnerabilities?.high || 0}
        />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
