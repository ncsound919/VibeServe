import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lightbulb, ClipboardList, Hammer, Eye, Shield, Wrench, BadgeCheck, Rocket,
  ChevronDown, ChevronRight, Settings
} from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { cn } from '../lib/utils';

type StepStatus = 'completed' | 'active' | 'failed' | 'pending';

interface PipelineStep {
  id: string;
  label: string;
  icon: typeof Lightbulb;
  status: StepStatus;
  progress?: number;
  contextualTools?: { label: string; tab: string; icon: typeof Lightbulb }[];
  subSteps?: { label: string; status: StepStatus; duration?: string }[];
}

const PIPELINE_STEPS: PipelineStep[] = [
  { id: 'architect', label: 'Architect', icon: Lightbulb, status: 'pending' },
  { id: 'plan', label: 'Plan', icon: ClipboardList, status: 'pending' },
  {
    id: 'build', label: 'Build', icon: Hammer, status: 'pending',
    contextualTools: [
      { label: 'Editor', tab: 'Editor', icon: Hammer },
      { label: 'Memory', tab: 'Memory', icon: Hammer },
    ],
  },
  { id: 'review', label: 'Review', icon: Eye, status: 'pending' },
  { id: 'audit', label: 'Audit', icon: Shield, status: 'pending' },
  {
    id: 'fix-retest', label: 'Fix & Retest', icon: Wrench, status: 'pending',
    subSteps: [
      { label: 'Fix', status: 'pending' },
      { label: 'E2E Testing', status: 'pending' },
      { label: 'Re-fix', status: 'pending' },
      { label: 'Re-audit', status: 'pending' },
    ],
  },
  { id: 'verify', label: 'Verify', icon: BadgeCheck, status: 'pending' },
  {
    id: 'deploy', label: 'Deploy', icon: Rocket, status: 'pending',
    contextualTools: [{ label: 'Preview', tab: 'Preview', icon: Rocket }],
  },
];

const STATUS_DOT: Record<StepStatus, string> = {
  completed: 'w-2 h-2 rounded-full bg-emerald-500',
  active: 'w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse ring-2 ring-emerald-500/30',
  failed: 'w-2 h-2 rounded-full bg-rose-500',
  pending: 'w-2 h-2 rounded-full border border-[#4a4b50]',
};

const STATUS_BG: Record<StepStatus, string> = {
  completed: 'bg-emerald-500/5',
  active: 'bg-emerald-500/10 border-emerald-500/20',
  failed: 'bg-rose-500/10 border-rose-500/20',
  pending: '',
};

export function PipelineSidebar() {
  const { activeTab, setActiveTab } = useAppStore();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);

  return (
    <aside className="w-20 lg:w-56 border-r border-[#1a1b1e] min-h-[calc(100vh-64px)] hidden md:flex flex-col bg-[#0a0a0c]">
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {PIPELINE_STEPS.map((step) => {
          const isExpanded = expandedGroup === step.id;
          const hasSubSteps = !!step.subSteps;

          return (
            <div key={step.id}>
              <button
                onClick={() => {
                  if (step.subSteps) {
                    setExpandedGroup(isExpanded ? null : step.id);
                  }
                  setSelectedStep(step.id);
                  // Map pipeline steps to actual tabs where possible
                  const stepToTab: Record<string, string> = {
                    architect: 'Composer',
                    build: 'Editor',
                    review: 'Review',
                    audit: 'Audit',
                    verify: 'Review',
                    deploy: 'Preview',
                  };
                  const tab = stepToTab[step.id];
                  if (tab) setActiveTab(tab as any);
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group',
                  STATUS_BG[step.status],
                  selectedStep === step.id && 'bg-white/5 ring-1 ring-emerald-500/20 text-white',
                  step.status === 'active' && 'border',
                  step.status === 'pending' && selectedStep !== step.id && 'text-[#4a4b50] hover:text-[#8E9299] hover:bg-[#151619]',
                  step.status === 'completed' && 'text-[#8E9299] hover:text-white hover:bg-[#151619]',
                  step.status === 'active' && 'text-white',
                  step.status === 'failed' && 'text-rose-400 hover:text-rose-300',
                )}
              >
                <step.icon size={18} className={cn(
                  step.status === 'completed' && 'text-emerald-500',
                  step.status === 'active' && 'text-emerald-400',
                  step.status === 'failed' && 'text-rose-500',
                )} />
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono truncate hidden lg:block">{step.label}</span>
                    {step.status === 'active' && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 hidden lg:inline">NOW</span>
                    )}
                  </div>
                  {step.status === 'active' && step.progress !== undefined && (
                    <div className="mt-1 h-1 rounded-full bg-[#1a1b1e] hidden lg:block">
                      <motion.div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400" initial={{ width: 0 }} animate={{ width: `${step.progress}%` }} />
                    </div>
                  )}
                </div>
                <div className={STATUS_DOT[step.status]} />
                {hasSubSteps && (
                  <span className="ml-auto hidden lg:block">
                    {isExpanded ? <ChevronDown size={12} className="text-[#4a4b50]" /> : <ChevronRight size={12} className="text-[#4a4b50]" />}
                  </span>
                )}
              </button>

              {/* Contextual tools */}
              <AnimatePresence>
                {step.status === 'active' && step.contextualTools && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="ml-9 space-y-0.5 mt-0.5 hidden lg:block">
                    {step.contextualTools.map((tool) => (
                      <button
                        key={tool.tab}
                        onClick={() => setActiveTab(tool.tab as any)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono text-[#8E9299] hover:text-white hover:bg-[#151619] transition-all"
                      >
                        <tool.icon size={12} />
                        {tool.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Sub-steps (fix & retest) */}
              <AnimatePresence>
                {isExpanded && hasSubSteps && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="ml-9 border-l border-[#1a1b1e] pl-3 space-y-0.5 mt-0.5 hidden lg:block">
                    {step.subSteps!.map((sub) => (
                      <div key={sub.label} className="flex items-center gap-2 py-1 text-[10px] font-mono">
                        <div className={cn(
                          sub.status === 'completed' ? 'w-1.5 h-1.5 rounded-full bg-emerald-500' :
                          sub.status === 'active' ? 'w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse' :
                          'w-1.5 h-1.5 rounded-full border border-[#4a4b50]'
                        )} />
                        <span className={cn(
                          sub.status === 'completed' ? 'text-emerald-400' :
                          sub.status === 'active' ? 'text-white' :
                          'text-[#4a4b50]'
                        )}>{sub.label}</span>
                        {sub.duration && <span className="text-[#4a4b50] ml-auto">{sub.duration}</span>}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* Settings Link */}
      <div className="border-t border-[#1a1b1e] p-2">
        <button
          onClick={() => setActiveTab('Settings' as any)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all',
            activeTab === 'Settings' ? 'bg-emerald-500/10 text-emerald-400' : 'text-[#4a4b50] hover:text-white hover:bg-[#151619]',
          )}
        >
          <Settings size={18} />
          <span className="text-xs font-mono hidden lg:block">Settings</span>
        </button>
      </div>
    </aside>
  );
}
