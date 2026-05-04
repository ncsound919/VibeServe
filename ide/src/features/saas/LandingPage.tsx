import { Hero } from './Hero';
import { Features } from './Features';
import { motion } from 'motion/react';
import { Check, ArrowRight } from 'lucide-react';

const PLANS = [
  {
    name: 'Standard',
    price: '$0',
    features: ['Local LLM Support', 'Single-File Generation', 'Basic RAG', 'Community Support'],
    cta: 'Start Building',
    popular: false
  },
  {
    name: 'Pro',
    price: '$49',
    features: ['Multi-File Planning', 'Architectural Review UI', 'Graphify RAG (5GB)', 'Priority Support'],
    cta: 'Get Pro Access',
    popular: true
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    features: ['Audit Dashboard', 'BOLA Security Guard', 'On-Prem Hosting', 'Custom Workflows'],
    cta: 'Contact Sales',
    popular: false
  }
];

const Pricing = () => {
  return (
    <section className="py-32 px-6 bg-[#050505]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-[0.3em] mb-4">Scalable Value</h2>
          <h3 className="text-4xl md:text-5xl font-black text-white tracking-tight">Simple Pricing.</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {PLANS.map((plan, i) => (
            <div 
              key={i}
              className={`relative p-8 rounded-3xl border transition-all ${
                plan.popular 
                  ? 'bg-indigo-600/10 border-indigo-500/30 scale-105 z-10 shadow-[0_0_50px_rgba(79,70,229,0.1)]' 
                  : 'bg-white/[0.02] border-white/5 hover:border-white/10'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-indigo-500 text-white text-[10px] font-bold rounded-full uppercase tracking-widest">
                  Most Popular
                </div>
              )}
              <h4 className="text-lg font-bold text-white mb-2">{plan.name}</h4>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-black text-white">{plan.price}</span>
                {plan.price !== 'Custom' && <span className="text-gray-500">/mo</span>}
              </div>
              <ul className="space-y-4 mb-10">
                {plan.features.map((f, fi) => (
                  <li key={fi} className="flex items-center gap-3 text-sm text-gray-400">
                    <Check className="w-4 h-4 text-emerald-400" />
                    {f}
                  </li>
                ))}
              </ul>
              <button className={`w-full py-4 rounded-2xl font-bold transition-all ${
                plan.popular 
                  ? 'bg-indigo-600 text-white hover:bg-indigo-500' 
                  : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
              }`}>
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#050505] selection:bg-indigo-500 selection:text-white">
      <Hero />
      <Features />
      <Pricing />
      
      {/* Footer */}
      <footer className="py-20 border-t border-white/5 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-white text-xl">N</div>
            <span className="text-lg font-bold text-white tracking-tighter">Nexus Alpha</span>
          </div>
          <div className="flex gap-8 text-gray-500 text-sm font-medium">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Twitter</a>
            <a href="#" className="hover:text-white transition-colors">GitHub</a>
          </div>
          <p className="text-gray-600 text-xs">© 2026 Nexus Alpha Inc. Built for Autonomy.</p>
        </div>
        
        {/* Autonomous Provenance Badge */}
        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-white/5 flex items-center justify-center">
          <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/[0.02] border border-white/5 text-[10px] font-mono text-gray-500">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>ORCHESTRATED BY NEXUS KERNEL</span>
            <span className="text-gray-700">|</span>
            <span className="text-indigo-400">PID: p_saas_gen_v2</span>
            <span className="text-gray-700">|</span>
            <span>2026-05-01 09:16:35</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
