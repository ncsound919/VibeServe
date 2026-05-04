import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ArrowRight, RotateCcw } from 'lucide-react';
import { VibeCoderProgress } from '../features/vibecoder/VibeCoderProgress';
import { VibeCoderResult } from '../features/vibecoder/VibeCoderResult';

type PipelinePhase = 'generating' | 'building' | 'testing' | 'done' | 'error';

interface PipelineResponse {
  success: boolean;
  appPath?: string;
  summary?: string;
  error?: string;
  buildResult?: Record<string, unknown>;
  logs?: string[];
}

const EXAMPLE_PROMPTS = [
  'A landing page for my startup',
  'A todo app with login',
  'A blog with a CMS',
  'An e-commerce store',
  'A SaaS dashboard',
];

export const VibeCoderTab = () => {
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<PipelinePhase | null>(null);
  const [phaseMessage, setPhaseMessage] = useState('');
  const [result, setResult] = useState<PipelineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [startTime, setStartTime] = useState(0);

  const handleGenerate = async () => {
    const description = input.trim();
    if (!description) return;

    setResult(null);
    setError(null);
    setLogs([]);
    setPhaseMessage('');
    setStartTime(Date.now());

    try {
      setPhase('generating');
      setPhaseMessage('Analyzing your description...');
      addLog('Starting pipeline with description...');

      const response = await fetch('/api/pipeline/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });

      if (!response.ok) {
        setPhase('error');
        setPhaseMessage(`Request failed with status ${response.status}`);
        setError(`Server responded with status ${response.status}`);
        addLog(`Error: HTTP ${response.status}`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            addLog(`[${event.type || 'info'}] ${event.message || JSON.stringify(event)}`);

            switch (event.type || event.phase) {
              case 'generating':
                setPhase('generating');
                break;
              case 'building':
                setPhase('building');
                break;
              case 'testing':
                setPhase('testing');
                break;
              case 'done':
              case 'complete':
                setPhase('done');
                break;
              case 'error':
                setPhase('error');
                setPhaseMessage(event.message || 'An error occurred');
                setError(event.message || 'Unknown error');
                break;
            }

            if (event.message) {
              setPhaseMessage(event.message);
            }

            if (event.final || event.type === 'complete') {
              setPhase('done');
              setResult({
                success: event.success !== false,
                appPath: event.appPath || event.path || '',
                summary: event.summary || event.message || 'App generated successfully',
                buildResult: event.buildResult,
                logs: event.logs,
              });
            }
          } catch {
            addLog(line);
          }
        }
      }

      if (!result) {
        setPhase('done');
      }
    } catch (err) {
      setPhase('error');
      const msg = err instanceof Error ? err.message : String(err);
      setPhaseMessage(msg);
      setError(msg);
      addLog(`Error: ${msg}`);
    }
  };

  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  const duration = startTime ? Date.now() - startTime : 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-180px)] py-12">
      <AnimatePresence mode="wait">
        {!phase ? (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="w-full max-w-2xl mx-auto text-center"
          >
            <div className="mb-8">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="flex items-center justify-center gap-2 mb-6"
              >
                <Sparkles size={32} className="text-emerald-500" />
              </motion.div>
              <h1 className="text-4xl sm:text-5xl font-bold text-white font-mono tracking-tighter mb-3">
                What do you want to build?
              </h1>
              <p className="text-sm text-[#9CA3AF] font-mono">
                Describe your idea in plain English and we'll generate the code for you.
              </p>
            </div>

            <div className="space-y-4">
              <textarea
                aria-label="App description"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Describe your app in plain English..."
                rows={4}
                className="w-full bg-[#151619] border border-[#2d2e32] rounded-xl p-4 text-white font-mono text-sm placeholder:text-[#4a4b50] focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 focus-visible:ring-2 focus-visible:ring-emerald-500/50 resize-none transition-all"
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
              />

              <div className="flex flex-wrap items-center justify-center gap-2">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <motion.button
                    key={prompt}
                    aria-label={`Use example: ${prompt}`}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => setInput(prompt)}
                    className="px-3 py-1.5 bg-[#151619] border border-[#2d2e32] rounded-full text-[11px] font-mono text-[#9CA3AF] hover:border-emerald-500/30 hover:text-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-500/50 transition-all"
                  >
                    {prompt}
                  </motion.button>
                ))}
              </div>

              <motion.button
                aria-label="Generate app"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleGenerate}
                disabled={!input.trim()}
                className="flex items-center gap-2 mx-auto px-8 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-[#2d2e32] disabled:text-[#6B7280] text-black font-bold font-mono text-sm rounded-xl focus-visible:ring-2 focus-visible:ring-emerald-500/50 transition-all"
              >
                <Sparkles size={16} />
                Generate
                <ArrowRight size={16} />
              </motion.button>
            </div>
          </motion.div>
        ) : phase === 'error' ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl mx-auto text-center"
          >
            <VibeCoderProgress
              status="error"
              message={error || phaseMessage}
              logs={logs}
            />
            <motion.button
              aria-label="Try again"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setPhase(null);
                setResult(null);
                setError(null);
                setLogs([]);
              }}
              className="flex items-center gap-2 mx-auto mt-6 px-6 py-2 border border-[#2d2e32] rounded-lg text-xs font-mono text-[#9CA3AF] hover:text-white hover:border-[#424348] focus-visible:ring-2 focus-visible:ring-emerald-500/50 transition-all"
            >
              <RotateCcw size={14} />
              Try Again
            </motion.button>
          </motion.div>
        ) : phase === 'done' && result ? (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl mx-auto"
          >
            <VibeCoderResult
              success={result.success}
              appPath={result.appPath || ''}
              summary={result.summary || 'Your app has been generated.'}
              duration={duration}
              buildResult={result.buildResult}
            />
            <motion.button
              aria-label="Generate another app"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setPhase(null);
                setResult(null);
                setInput('');
                setLogs([]);
              }}
              className="flex items-center gap-2 mx-auto mt-6 px-6 py-2 border border-[#2d2e32] rounded-lg text-xs font-mono text-[#9CA3AF] hover:text-white hover:border-[#424348] focus-visible:ring-2 focus-visible:ring-emerald-500/50 transition-all"
            >
              <Sparkles size={14} />
              Generate Another
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            key="progress"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl mx-auto"
          >
            <VibeCoderProgress
              status={phase || 'generating'}
              message={phaseMessage}
              logs={logs}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
