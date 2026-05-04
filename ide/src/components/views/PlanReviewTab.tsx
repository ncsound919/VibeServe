import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ClipboardList, 
  CheckCircle2, 
  Circle, 
  ArrowRight, 
  Play, 
  ShieldCheck,
  AlertCircle,
  Code2
} from 'lucide-react';
import { DiffViewer } from '../DiffViewer';
import type { MultiFilePlan, PlanStep } from '../../core/agents/types';

export default function PlanReviewTab() {
  const [activePlan, setActivePlan] = useState<MultiFilePlan | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch plan from server (mock for demonstration)
  useEffect(() => {
    // In a real Phase 2 implementation, we would poll /api/coding/plan
    // or use a WebSocket to receive the plan from the Temporal workflow.
    const mockPlan: MultiFilePlan = {
      id: 'plan_123',
      title: 'Implement Authentication Guard',
      summary: 'Add JWT verification to all sensitive routes and implement a secure token refresh logic.',
      steps: [
        { id: '1', file: 'src/server/hono.ts', action: 'modify', purpose: 'Inject requireRole middleware into /api/proxy routes', status: 'pending' },
        { id: '2', file: 'src/server/auth.ts', action: 'create', purpose: 'New authentication utility for token validation', status: 'pending' },
        { id: '3', file: 'src/services/apiClient.ts', action: 'modify', purpose: 'Auto-attach Bearer tokens to outbound requests', status: 'pending' }
      ]
    };
    setActivePlan(mockPlan);
    setSelectedStepId(mockPlan.steps[0].id);
  }, []);

  const handleApply = async () => {
    if (!activePlan) return;
    setIsApplying(true);
    setError(null);
    try {
      const res = await fetch('/api/coding/plan/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: activePlan.id })
      });
      if (!res.ok) throw new Error('Failed to initiate plan application');
      
      // Simulate progress
      for (const step of activePlan.steps) {
        setSelectedStepId(step.id);
        await new Promise(r => setTimeout(r, 1000));
        setActivePlan(prev => prev ? {
          ...prev,
          steps: prev.steps.map(s => s.id === step.id ? { ...s, status: 'completed' } : s)
        } : null);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsApplying(false);
    }
  };

  const selectedStep = activePlan?.steps.find(s => s.id === selectedStepId);

  return (
    <div className="p-6 h-[calc(100vh-120px)] flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="text-indigo-400 w-5 h-5" />
            <h1 className="text-xl font-bold text-white">Architectural Review</h1>
          </div>
          <p className="text-sm text-gray-500">Approve and execute multi-file implementation plans</p>
        </div>
        <div className="flex gap-3">
          <button 
            disabled={!activePlan || isApplying}
            onClick={handleApply}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20"
          >
            {isApplying ? <RefreshCw className="animate-spin w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isApplying ? 'Executing...' : 'Approve & Execute'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Left: Step List */}
        <div className="w-80 flex flex-col gap-4">
          <div className="glass-card rounded-2xl p-4 border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-300 mb-4">Plan Overview</h3>
            <h4 className="text-sm font-bold text-white mb-2">{activePlan?.title}</h4>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">{activePlan?.summary}</p>
            
            <div className="space-y-2">
              {activePlan?.steps.map((step) => (
                <button
                  key={step.id}
                  onClick={() => setSelectedStepId(step.id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl transition-all text-left border ${
                    selectedStepId === step.id 
                      ? 'bg-indigo-500/10 border-indigo-500/30' 
                      : 'bg-white/5 border-transparent hover:border-white/10'
                  }`}
                >
                  <div className="mt-0.5">
                    {step.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Circle className={`w-4 h-4 ${selectedStepId === step.id ? 'text-indigo-400' : 'text-gray-600'}`} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className={`text-xs font-bold truncate ${selectedStepId === step.id ? 'text-white' : 'text-gray-400'}`}>
                      {step.file.split('/').pop()}
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">{step.action.toUpperCase()} • {step.file}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4 border-white/5 flex items-center gap-3">
            <ShieldCheck className="text-emerald-400 w-5 h-5" />
            <div>
              <div className="text-[10px] font-bold text-white uppercase">Security Clearance</div>
              <div className="text-[9px] text-gray-500">Plan passed 12 automated guardrails</div>
            </div>
          </div>
        </div>

        {/* Right: Detail / Diff */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {selectedStep ? (
            <>
              <div className="glass-card rounded-2xl p-4 border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                    <Code2 className="text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Step Purpose</h3>
                    <p className="text-xs text-gray-400">{selectedStep.purpose}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-white/5 rounded-lg text-[10px] font-mono text-gray-400 uppercase">{selectedStep.action}</span>
                </div>
              </div>

              <div className="flex-1 min-h-0">
                <DiffViewer 
                  diff={[]} // In a real implementation, this would show the diff for the selected step
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-30 select-none">
              <ClipboardList size={64} className="text-indigo-500 mb-4" />
              <p className="text-sm font-mono uppercase tracking-[0.2em] text-indigo-300">Select a step to review</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-12 right-12 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3"
          >
            <AlertCircle className="text-red-400 w-5 h-5" />
            <span className="text-xs text-red-300 font-mono">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-component for icons
function RefreshCw({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 21v-5h5" />
    </svg>
  );
}
