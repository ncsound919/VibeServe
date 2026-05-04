import { motion } from 'motion/react';
import { 
  Brain, 
  Cpu, 
  ShieldCheck, 
  Zap, 
  Layers, 
  GitMerge, 
  Eye, 
  Workflow 
} from 'lucide-react';

const FEATURE_CARDS = [
  {
    title: 'Multi-File Architect',
    description: 'Decompose high-level intent into precise, coordinated execution plans across your entire stack.',
    icon: Layers,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    span: 'col-span-2'
  },
  {
    title: 'Durable Workflows',
    description: 'Resilient orchestration powered by Temporal for long-running agent missions.',
    icon: Workflow,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    span: 'col-span-1'
  },
  {
    title: 'Zero-Trust Security',
    description: 'Ownership-based ACLs and sandboxed command execution keep your code safe.',
    icon: ShieldCheck,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    span: 'col-span-1'
  },
  {
    title: 'Graphify RAG',
    description: 'Codebase discovery using knowledge graphs for 71.5x better grounding accuracy.',
    icon: Brain,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    span: 'col-span-2'
  }
];

export const Features = () => {
  return (
    <section className="py-32 px-6 bg-[#050505]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-sm font-bold text-indigo-400 uppercase tracking-[0.3em] mb-4">Core Intelligence</h2>
          <h3 className="text-4xl md:text-5xl font-black text-white tracking-tight">Built for Autonomy.</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURE_CARDS.map((feature, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -5 }}
              className={`${feature.span} p-8 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group`}
            >
              <div className={`w-12 h-12 rounded-2xl ${feature.bg} flex items-center justify-center mb-6 border border-white/5`}>
                <feature.icon className={`w-6 h-6 ${feature.color}`} />
              </div>
              <h4 className="text-xl font-bold text-white mb-3">{feature.title}</h4>
              <p className="text-gray-500 leading-relaxed text-sm">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
