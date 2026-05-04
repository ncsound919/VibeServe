import { motion } from 'motion/react';
import { Rocket, Shield, Zap, ArrowRight } from 'lucide-react';

export const Hero = () => {
  return (
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center pt-20 pb-32 px-6 overflow-hidden bg-[#050505]">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/20 blur-[160px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-emerald-600/10 blur-[140px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 text-center max-w-5xl mx-auto"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-indigo-400 text-xs font-bold mb-8 backdrop-blur-md">
          <Zap className="w-3 h-3 animate-pulse" />
          <span>Nexus Alpha v2.0 is Now Live</span>
        </div>

        <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter mb-8 leading-[0.9]">
          The OS for <br />
          <span className="bg-gradient-to-r from-indigo-400 via-emerald-400 to-sky-400 bg-clip-text text-transparent">
            AI-Native Engineering
          </span>
        </h1>

        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
          Decompose, Architect, and Execute complex software systems with a 
          hardened autonomous kernel. Multi-file reasoning meets zero-trust security.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <button className="px-8 py-4 bg-white text-black font-bold rounded-2xl hover:bg-gray-200 transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)] flex items-center gap-2">
            Start Building Free
            <ArrowRight className="w-4 h-4" />
          </button>
          <button className="px-8 py-4 bg-white/5 text-white font-bold rounded-2xl border border-white/10 hover:bg-white/10 transition-all backdrop-blur-sm">
            View Documentation
          </button>
        </div>
      </motion.div>

      {/* Floating UI Elements Decor */}
      <motion.div
        animate={{ y: [0, -20, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/2 -left-12 w-64 h-32 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl hidden lg:block"
      >
        <div className="p-4 space-y-2">
          <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase">
            <span>Kernel PID</span>
            <span className="text-emerald-400">p_72k8s</span>
          </div>
          <div className="h-1 w-full bg-emerald-500/20 rounded-full overflow-hidden">
            <div className="h-full w-2/3 bg-emerald-500" />
          </div>
          <div className="text-[10px] text-gray-400 font-mono">Synthesizing LLM Wiki...</div>
        </div>
      </motion.div>
    </section>
  );
};
