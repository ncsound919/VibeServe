/**
 * Magic Composer (Single-Prompt Mode)
 * 
 * A simplified, high-level interface for non-developers or quick tasks.
 * Translates a single prompt into a full project plan or code change.
 */
import { useState } from 'react';
import { Sparkles, ArrowRight, Wand2, Shield, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useParallelOrchestrator } from '../../services/parallelAgentOrchestrator';
import { cn } from '../../lib/utils';

export const MagicComposer = () => {
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultId, setResultId] = useState<string | null>(null);
  const { createWorkflow, executeWorkflow } = useParallelOrchestrator();

  const handleMagicAction = async () => {
    if (!prompt.trim()) return;
    setIsProcessing(true);
    
    try {
      // Magic logic: Create a comprehensive research + code workflow
      const workflowId = createWorkflow(`Magic: ${prompt.slice(0, 30)}...`, 'fan-out');
      setResultId(workflowId);
      
      // Execute in background
      await executeWorkflow(workflowId);
    } catch (e) {
      console.error('Magic failed:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <div className="text-center mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-mono mb-4"
        >
          <Sparkles size={12} />
          MANDATORY_INTELLIGENCE_ACTIVE
        </motion.div>
        <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">
          What can I <span className="text-indigo-400">build</span> for you today?
        </h1>
        <p className="text-gray-400 text-sm max-w-lg mx-auto">
          One prompt to rule them all. Nexus Alpha will orchestrate agents, 
          verify security, and deploy artifacts automatically.
        </p>
      </div>

      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
        <div className="relative bg-[#0a0a0c] border border-[#2d2e32] rounded-2xl overflow-hidden shadow-2xl">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Build a secure real-time dashboard for monitoring crypto trends with Yjs and Gemini..."
            className="w-full bg-transparent text-white p-8 min-h-[160px] outline-none text-lg placeholder:text-[#4a4b50] resize-none"
          />
          
          <div className="px-8 py-4 bg-[#151619]/50 border-t border-[#1a1b1e] flex justify-between items-center">
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#4a4b50]">
                <Shield size={12} className="text-emerald-500" />
                SECURE_GATE: ON
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#4a4b50]">
                <Zap size={12} className="text-amber-500" />
                TURBO_MODE: ON
              </div>
            </div>
            
            <button
              onClick={handleMagicAction}
              disabled={isProcessing || !prompt.trim()}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
                isProcessing || !prompt.trim()
                  ? "bg-[#2d2e32] text-[#4a4b50] cursor-not-allowed"
                  : "bg-white text-black hover:bg-indigo-400 hover:text-white"
              )}
            >
              {isProcessing ? (
                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <Wand2 size={16} />
              )}
              {isProcessing ? "Manifesting..." : "Run Magic"}
              {!isProcessing && <ArrowRight size={16} />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {resultId && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-12 p-6 rounded-2xl bg-[#151619] border border-[#2d2e32] flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                <Workflow className="text-indigo-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Workflow Orchestrated</h3>
                <p className="text-xs text-[#4a4b50] font-mono">ID: {resultId}</p>
              </div>
            </div>
            <button 
              className="px-4 py-2 rounded-lg bg-[#2d2e32] text-xs font-bold text-white hover:bg-[#3d3e42] transition-colors"
              onClick={() => window.location.hash = '#Pipeline'}
            >
              Monitor Progress
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: Shield, title: 'Security First', desc: 'Auto-scan for secrets and vulns' },
          { icon: Zap, title: 'Zero Latency', desc: 'Sub-100ms local intelligence' },
          { icon: Wand2, title: 'Multi-Agent', desc: 'Parallel coordination of 5+ agents' },
        ].map((feat, i) => (
          <div key={i} className="p-4 rounded-xl border border-[#1a1b1e] hover:border-[#2d2e32] transition-colors group">
            <feat.icon size={20} className="text-[#4a4b50] group-hover:text-indigo-400 transition-colors mb-3" />
            <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-1">{feat.title}</h4>
            <p className="text-[10px] text-[#4a4b50]">{feat.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
