/**
 * InlineComposer — Cmd+I agent mode prompt bar.
 * Cursor-style: describe what you want, AI plans, edits files, shows diffs.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Send, FileCode, X, Loader2, CheckCircle2, Play, ArrowRight } from 'lucide-react';
import type { DiffChange } from './InlineDiffOverlay';
import { computeDiff } from './InlineDiffOverlay';

interface AgentFilePlan {
  path: string;
  action: 'modify' | 'create' | 'delete';
  language: string;
  content: string;
}

interface AgentResult {
  summary: string;
  plan: string[];
  files: AgentFilePlan[];
}

export interface InlineComposerProps {
  visible: boolean;
  onClose: () => void;
  onApplyChanges: (changes: DiffChange[]) => void;
}

export function InlineComposer({ visible, onClose, onApplyChanges }: InlineComposerProps) {
  const [prompt, setPrompt] = useState('');
  const [phase, setPhase] = useState<'idle' | 'planning' | 'editing' | 'done'>('idle');
  const [planSteps, setPlanSteps] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setPrompt('');
      setPhase('idle');
      setPlanSteps([]);
      setSummary('');
      setError(null);
    }
  }, [visible]);

  const handleSubmit = useCallback(async () => {
    const text = prompt.trim();
    if (!text) return;

    setPhase('planning');
    setError(null);
    setPlanSteps([]);
    setSummary('');

    try {
      // Gather context
      let contextStr = '';
      try {
        const ctxRes = await fetch('/api/editor/files', { signal: AbortSignal.timeout(2000) });
        const ctxData = await ctxRes.json();
        if (ctxData.files) {
          const fileNames = (ctxData.files as Array<{ path: string }>)
            .map((f) => f.path)
            .slice(0, 20)
            .join('\n');
          contextStr = `Project files:\n${fileNames}`;
        }
      } catch {
        // No context available
      }

      const res = await fetch('/api/agent/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, context: contextStr }),
      });

      const raw = await res.json();
      const result: AgentResult & { error?: string } = raw;

      if (result.error) {
        setError(result.error);
        setPhase('idle');
        return;
      }

      setSummary(result.summary);
      setPlanSteps(result.plan);
      setPhase('editing');

      // Simulate step-by-step progress
      for (let i = 0; i < result.plan.length; i++) {
        setCurrentStep(i);
        await new Promise((r) => setTimeout(r, 400));
      }
      setCurrentStep(result.plan.length);

      // Convert agent files to diff changes
      const changes: DiffChange[] = [];
      for (const file of result.files) {
        // Try to fetch existing content
        let oldContent = '';
        try {
          const fileRes = await fetch(`/api/editor/file?path=${encodeURIComponent(file.path)}`);
          const fileData = await fileRes.json();
          if (fileData.content) oldContent = fileData.content;
        } catch {
          // File doesn't exist
        }

        const hunks = computeDiff(oldContent, file.content, file.path);
        changes.push({
          fileName: file.path,
          oldContent,
          newContent: file.content,
          language: file.language,
          hunks,
        });
      }

      setPhase('done');

      if (changes.length > 0) {
        onApplyChanges(changes);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Agent error');
      setPhase('idle');
    }
  }, [prompt, onApplyChanges]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[600px] rounded-xl border border-[#30363d] bg-[#161b22] shadow-2xl overflow-hidden"
        >
          {/* Input area */}
          {phase === 'idle' && (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[#21262d]">
                <Sparkles className="w-4 h-4 text-[#58a6ff] flex-shrink-0" />
                <input
                  ref={inputRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="What do you want to change? e.g. Add error handling to all API routes"
                  className="flex-1 bg-transparent border-none outline-none text-[#c9d1d9] text-sm placeholder:text-[#484f58]"
                />
                <button
                  onClick={handleSubmit}
                  disabled={!prompt.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1f6feb] text-white rounded-lg text-xs font-medium hover:bg-[#388bfd] disabled:bg-[#21262d] disabled:text-[#484f58] transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  Run
                </button>
                <button onClick={onClose} className="p-1.5 rounded hover:bg-[#21262d] text-[#7d8590]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-4 py-2 text-[10px] text-[#484f58]">
                Agent will plan changes, search the codebase, and present diffs for your review
              </div>
            </>
          )}

          {/* Planning phase */}
          {(phase === 'planning' || phase === 'editing' || phase === 'done') && (
            <div className="p-5">
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                {phase === 'planning' ? (
                  <Loader2 className="w-5 h-5 text-[#58a6ff] animate-spin" />
                ) : phase === 'editing' ? (
                  <Loader2 className="w-5 h-5 text-[#d29922] animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-[#3fb950]" />
                )}
                <div>
                  <div className="text-sm font-semibold text-[#c9d1d9]">
                    {phase === 'planning' ? 'Planning changes...' : phase === 'editing' ? 'Generating edits...' : 'Ready to apply'}
                  </div>
                  <div className="text-xs text-[#7d8590]">{summary || prompt}</div>
                </div>
              </div>

              {/* Plan steps */}
              {planSteps.length > 0 && (
                <div className="space-y-2 mb-4">
                  {planSteps.map((step, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 text-xs transition-colors ${
                        i < currentStep
                          ? 'text-[#3fb950]'
                          : i === currentStep && phase === 'editing'
                            ? 'text-[#d29922]'
                            : 'text-[#484f58]'
                      }`}
                    >
                      {i < currentStep ? (
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                      ) : i === currentStep && phase === 'editing' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
                      )}
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-[#f85149]/10 border border-[#f85149]/20 text-xs text-[#f85149] mb-3">
                  {error}
                </div>
              )}

              {/* Dismiss button when done */}
              {phase === 'done' && (
                <button
                  onClick={onClose}
                  className="w-full py-2 rounded-lg bg-[#21262d] text-xs text-[#7d8590] hover:text-[#c9d1d9] hover:bg-[#30363d] transition-colors"
                >
                  Review changes below
                </button>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
