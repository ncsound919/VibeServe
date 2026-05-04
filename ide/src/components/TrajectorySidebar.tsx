import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, CircleDashed, XCircle, PauseCircle, PlayCircle, GitCommit } from 'lucide-react';

interface TrajectoryEvent {
  runId: string;
  step: string;
  status: 'completed' | 'failed' | 'pending' | 'paused';
  metadata?: any;
  timestamp: number;
}

export function TrajectorySidebar() {
  const [events, setEvents] = useState<TrajectoryEvent[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    // Connect to Nexus-Alpha WebSocket
    const wsUrl = `ws://${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'trajectory:update') {
          setEvents((prev) => {
            const existing = prev.findIndex(e => e.step === data.data.step);
            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = { ...updated[existing], status: data.data.status, metadata: data.data.metadata };
              return updated;
            }
            return [...prev, data.data];
          });
        }
      } catch (e) {
        console.error('WS Parse error', e);
      }
    };

    return () => ws.close();
  }, []);

  const handleIntervene = (step: string) => {
    // High-priority WebSocket or API call to Orchestrator to pause
    setIsPaused(true);
    console.log(`[Slider of Autonomy] Intervening at step: ${step}`);
    // In a full implementation, this sends a CRDT update or REST call to CodeNexus
  };

  const getIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'failed': return <XCircle className="w-5 h-5 text-rose-500" />;
      case 'paused': return <PauseCircle className="w-5 h-5 text-amber-500" />;
      case 'pending': 
      default: return <CircleDashed className="w-5 h-5 text-indigo-400 animate-spin-slow" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 text-slate-200 w-80">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
        <h2 className="text-sm font-semibold tracking-wide text-slate-300 uppercase flex items-center gap-2">
          <GitCommit className="w-4 h-4 text-indigo-500" />
          Agent Trajectory
        </h2>
        <button 
          onClick={() => setIsPaused(!isPaused)}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
            isPaused ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
          }`}
        >
          {isPaused ? 'Autonomy: PAUSED' : 'Autonomy: FULL'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {events.length === 0 ? (
            <div className="text-center text-slate-500 text-sm mt-10">
              Waiting for Agent orchestration...
            </div>
          ) : (
            events.map((ev, i) => (
              <motion.div 
                key={ev.step + i}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="relative pl-6 border-l-2 border-slate-800 pb-4 last:border-transparent last:pb-0"
              >
                <div className="absolute -left-[11px] top-0 bg-slate-900 rounded-full">
                  {getIcon(ev.status)}
                </div>
                
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-slate-200 capitalize">
                    {ev.step.replace(/_/g, ' ')}
                  </span>
                  
                  {ev.status === 'failed' && ev.metadata?.error && (
                    <span className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded">
                      {ev.metadata.error}
                    </span>
                  )}

                  {ev.status === 'pending' && (
                    <div className="mt-2 flex gap-2">
                      <button 
                        onClick={() => handleIntervene(ev.step)}
                        className="text-xs bg-indigo-500 hover:bg-indigo-600 text-white px-2 py-1 rounded transition-colors"
                      >
                        Intervene / Edit
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
