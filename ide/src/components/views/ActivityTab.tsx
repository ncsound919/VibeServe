import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Box, Calendar, ChevronRight, Code, FolderOpen, RefreshCcw, AlertTriangle, Clock, Layers } from 'lucide-react';
import { usePipelineStore } from '../stores/usePipelineStore';
import { cn } from '../lib/utils';

interface GeneratedApp {
  name: string;
  path: string;
  created: string;
}

interface AppDetail {
  name: string;
  path: string;
  created: string;
  fileCount: number;
  sizeKB: number;
  exists: boolean;
}

type FetchState = 'loading' | 'error' | 'empty' | 'populated';

export const ActivityTab = () => {
  const [apps, setApps] = useState<GeneratedApp[]>([]);
  const [appsState, setAppsState] = useState<FetchState>('loading');
  const [appsError, setAppsError] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<AppDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const executions = usePipelineStore((s) => s.executions);
  const activeExecution = usePipelineStore((s) => s.activeExecution);

  const fetchApps = useCallback(async () => {
    setAppsState('loading');
    setAppsError(null);
    try {
      const res = await fetch('/api/coding-agent/apps');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = data.apps || data || [];
      setApps(list);
      setAppsState(list.length > 0 ? 'populated' : 'empty');
    } catch (err) {
      setAppsError(err instanceof Error ? err.message : String(err));
      setAppsState('error');
    }
  }, []);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  const fetchAppDetail = async (app: GeneratedApp) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/coding-agent/apps/${encodeURIComponent(app.name)}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedApp(data);
      } else {
        setSelectedApp({ ...app, exists: true, fileCount: 0, sizeKB: 0 });
      }
    } catch {
      setSelectedApp({ ...app, exists: true, fileCount: 0, sizeKB: 0 });
    } finally {
      setDetailLoading(false);
    }
  };

  const recentPipelineRuns = executions.slice(0, 5);
  const hasPipelineData = recentPipelineRuns.length > 0 || activeExecution;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tighter">Activity</h2>
           <p className="text-[11px] text-[#9CA3AF] font-mono mt-1">Generated apps and recent pipeline runs</p>
        </div>
        <button
            aria-label="Refresh apps"
          onClick={fetchApps}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1b1e] border border-[#2d2e32] rounded-lg text-[10px] font-mono text-[#9CA3AF] hover:text-white hover:border-[#424348] focus-visible:ring-2 focus-visible:ring-emerald-500/50 transition-all"
        >
          <RefreshCcw size={12} className={appsState === 'loading' ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Box size={16} className="text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Generated Apps</h3>
            {appsState === 'populated' && (
              <span className="text-[10px] font-mono text-[#6B7280]">({apps.length})</span>
            )}
          </div>

          <div className="space-y-3">
            {appsState === 'loading' && (
              <div className="flex items-center justify-center py-12">
                <RefreshCcw size={20} className="animate-spin text-emerald-500" />
              </div>
            )}

            {appsState === 'error' && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertTriangle size={24} className="text-red-400 mb-2" />
                <p className="text-[11px] text-[#9CA3AF] font-mono mb-3">Failed to load apps</p>
                <p className="text-[10px] text-[#6B7280] font-mono mb-4">{appsError}</p>
                <button
                  aria-label="Retry loading apps"
                  onClick={fetchApps}
                  className="px-4 py-1.5 bg-[#1a1b1e] border border-[#2d2e32] rounded-lg text-[10px] font-mono text-emerald-400 hover:text-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/50 transition-all"
                >
                  Retry
                </button>
              </div>
            )}

            {appsState === 'empty' && (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-[#1a1b1e]/30 border border-[#2d2e32] rounded-xl">
                <Box size={24} className="text-[#6B7280] mb-2" />
                <p className="text-[11px] text-[#9CA3AF] font-mono">No apps generated yet</p>
                <p className="text-[10px] text-[#6B7280] font-mono mt-1">Use the VibeCoder to create your first app</p>
              </div>
            )}

            {appsState === 'populated' && apps.map((app, i) => (
              <motion.div
                key={app.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => fetchAppDetail(app)}
                className={cn(
                  'bg-[#1a1b1e]/50 border border-[#2d2e32] rounded-xl p-4 hover:border-emerald-500/30 transition-all cursor-pointer group',
                  selectedApp?.name === app.name && 'border-emerald-500/40',
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Code size={14} className="text-emerald-400/70 shrink-0" />
                      <h4 className="text-sm font-mono font-medium text-white truncate">{app.name}</h4>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-mono text-[#6B7280]">
                      <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        {new Date(app.created).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <FolderOpen size={10} />
                        {app.path.split('/').pop() || app.path}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-[#6B7280] group-hover:text-emerald-400 transition-colors shrink-0 mt-1" />
                </div>

                <AnimatePresence>
                  {selectedApp?.name === app.name && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-[#2d2e32]">
                        {detailLoading ? (
                          <div className="flex items-center justify-center py-3">
                            <RefreshCcw size={14} className="animate-spin text-emerald-500" />
                          </div>
                        ) : selectedApp ? (
                          <div className="grid grid-cols-3 gap-3">
                            <div className="bg-[#0a0a0c]/50 border border-[#2d2e32] rounded-lg p-3 text-center">
                              <div className="text-sm font-mono font-bold text-emerald-400">{selectedApp.fileCount}</div>
                              <div className="text-[9px] text-[#6B7280] font-mono mt-0.5">Files</div>
                            </div>
                            <div className="bg-[#0a0a0c]/50 border border-[#2d2e32] rounded-lg p-3 text-center">
                              <div className="text-sm font-mono font-bold text-amber-400">{selectedApp.sizeKB}</div>
                              <div className="text-[9px] text-[#6B7280] font-mono mt-0.5">KB Size</div>
                            </div>
                            <div className="bg-[#0a0a0c]/50 border border-[#2d2e32] rounded-lg p-3 text-center">
                              <div className={cn(
                                'text-sm font-mono font-bold',
                                selectedApp.exists ? 'text-emerald-400' : 'text-red-400',
                              )}>
                                {selectedApp.exists ? 'Active' : 'Missing'}
                              </div>
                              <div className="text-[9px] text-[#6B7280] font-mono mt-0.5">Status</div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <Layers size={16} className="text-amber-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Pipeline Runs</h3>
            {hasPipelineData && (
              <span className="text-[10px] font-mono text-[#6B7280]">({executions.length})</span>
            )}
          </div>

          <div className="space-y-3">
            {!hasPipelineData && (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-[#1a1b1e]/30 border border-[#2d2e32] rounded-xl">
                <Activity size={24} className="text-[#6B7280] mb-2" />
                <p className="text-[11px] text-[#9CA3AF] font-mono">No pipeline runs yet</p>
                <p className="text-[10px] text-[#6B7280] font-mono mt-1">Trigger a pipeline from repo analysis</p>
              </div>
            )}

            {activeExecution && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">Active</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-mono font-medium text-white">{activeExecution.id}</h4>
                  <span className="text-[10px] font-mono text-emerald-400">{Math.round(activeExecution.progress)}%</span>
                </div>
                <p className="text-[10px] text-[#9CA3AF] font-mono mb-2">{activeExecution.currentStep}</p>
                <div className="w-full h-1 bg-[#0a0a0c] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-emerald-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${activeExecution.progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </motion.div>
            )}

            {recentPipelineRuns.map((exec, i) => (
              <motion.div
                key={exec.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-[#1a1b1e]/50 border border-[#2d2e32] rounded-xl p-4 hover:border-[#424348] transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-xs font-mono font-medium text-white truncate">{exec.id}</h4>
                  <span className={cn(
                    'text-[9px] font-mono px-1.5 py-0.5 rounded',
                    exec.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                    exec.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                    exec.status === 'running' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-[#2d2e32]/50 text-[#6B7280]',
                  )}>
                    {exec.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono text-[#6B7280]">
                  <span className="flex items-center gap-1">
                    <Box size={10} />
                    {exec.sourceRepos.join(', ')}
                  </span>
                  {exec.duration != null && (
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {exec.duration}ms
                    </span>
                  )}
                </div>
                {exec.logs && exec.logs.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[#2d2e32]">
                    <p className="text-[9px] font-mono text-[#6B7280] truncate">{exec.logs[exec.logs.length - 1]}</p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
