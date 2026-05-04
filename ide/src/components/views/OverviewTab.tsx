/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import {
  BarChart3, TrendingUp, Globe, Activity, Zap, Github,
  ShieldCheck, Database, Share2, Cpu, Trophy,
} from 'lucide-react';
import { SectionHeader } from '../components/SectionHeader';
import { GrowthChart } from '../features/overview/GrowthChart';
import { StatCard } from '../features/overview/StatCard';
import { PredictionCard } from '../features/overview/PredictionCard';
import { GamifiedDashboard } from '../features/overview/GamifiedDashboard';
import { ErrorDashboard } from '../features/overview/ErrorDashboard';
import { VibeCoderDashboard } from '../features/overview/VibeCoderDashboard';
import { TrendInsightsDashboard } from '../features/overview/TrendInsightsDashboard';
import { OpenSourceWidget } from '../features/overview/OpenSourceWidget';
import { NewsCard } from '../features/overview/NewsCard';
import { SynergyInsightsWidget } from '../features/overview/SynergyInsightsWidget';
import { HarvestIntelligenceWidget } from '../features/overview/HarvestIntelligenceWidget';
import { NexusIntelligenceWidget } from '../features/overview/NexusIntelligenceWidget';
import { cn } from '../lib/utils';
import { useNexusStats } from '../hooks/useNexusStats';
import type { DashboardData } from '../types';

interface OverviewTabProps {
  data: DashboardData;
  nexusSystemStatus: string;
  onTabChange: (tab: string) => void;
  latency?: number;
}

const ENGINE_OPTIMIZATIONS = [
  { label: 'Serena Context Engine', value: 'Active', desc: 'Unified MCP context management and prompt enrichment.', icon: Share2, color: 'text-indigo-400' },
  { label: 'Codeix Indexer', value: 'Portable', desc: 'Language-agnostic symbol indexing with Bloom filters.', icon: Database, color: 'text-blue-400' },
  { label: 'Semantic Compression', value: '94.2%', desc: 'RAG vector retrieval optimization for dense browser traces.', icon: Database, color: 'text-blue-400' },
  { label: 'Model Optimization', value: 'Locked', desc: 'Model parameters optimized for low-latency autonomous browsing.', icon: Cpu, color: 'text-emerald-400' },
] as const;

const QUICK_ACTIONS = [
  { title: 'View Activity', desc: 'Generated apps and pipeline runs', icon: Github, tab: 'Activity', color: 'from-emerald-500/20' },
  { title: 'Monitor Pipeline', desc: 'View active build clusters', icon: Activity, tab: 'Pipeline', color: 'from-amber-500/20' },
  { title: 'Command Center', desc: 'CLI and agent management', icon: Zap, tab: 'Command Center', color: 'from-blue-500/20' },
] as const;

export const OverviewTab = ({ data, nexusSystemStatus, onTabChange }: OverviewTabProps) => {
  const { data: nexus } = useNexusStats();

  return (
    <>
    {/* Hero Header */}
    <div className="flex justify-between items-start mb-8">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tighter sm:text-4xl">
          Executive Dashboard
        </h2>
        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">System Connected</span>
          </div>
          <div className={cn(
            'flex items-center gap-1.5 px-2 py-0.5 rounded-full border transition-all',
            nexusSystemStatus === 'IDLE'
              ? 'bg-[#1a1b1e] border-[#2d2e32] text-[#4a4b50]'
              : 'bg-blue-500/10 border-blue-500/30 text-blue-400',
          )}>
            <span className="text-[10px] font-mono uppercase tracking-widest animate-pulse">
              Nexus_{nexusSystemStatus}
            </span>
          </div>
        </div>
      </div>
      <div className="hidden lg:block text-right">
        <div className="text-[10px] font-mono text-[#4a4b50] uppercase tracking-widest mb-1">System Grade</div>
        <div className="text-xl font-bold text-white font-mono tracking-tighter">{nexus?.vibeGrade || '—'}</div>
      </div>
    </div>

    {/* Hero Metrics */}
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-6 mb-12">
      <StatCard
        title="VibeCoder Grade"
        value={nexus?.vibeScore ?? 0}
        unit={`/ ${nexus?.vibeMaxScore ?? 75}`}
        icon={Trophy}
        trend={nexus?.vibeGrade ? `Grade: ${nexus.vibeGrade}` : 'Pending'}
      />
      <StatCard
        title="Pipeline Runs"
        value={nexus?.pipelineRuns ?? 0}
        unit={`${nexus?.pipelineWins ?? 0} wins`}
        icon={Activity}
        trend={nexus?.totalBuilds ? `${nexus.totalBuilds} builds` : '0 builds'}
      />
      <StatCard
        title="Nexus Level"
        value={nexus?.currentLevel ?? 0}
        unit={nexus?.levelTitle ?? ''}
        icon={Trophy}
      />
      <StatCard
        title="Integrations Wired"
        value={nexus?.integrationsActive ?? 0}
        unit={`/ ${nexus?.integrationsTotal ?? 0}`}
        icon={Cpu}
        trend={nexus?.tokenSavingsPercent ? `-${nexus.tokenSavingsPercent}% tokens` : 'TOON active'}
      />
      <StatCard
        title="System Health"
        value={nexus?.errorResolved ?? 0}
        unit={`/ ${nexus?.errorTotal ?? 0}`}
        icon={ShieldCheck}
        trend={nexus?.errorStreak ? `${nexus.errorStreak} failure streak` : 'Clean'}
      />
    </div>

    {/* Gamified Progression Dashboard */}
    <div className="mb-12">
      <div className="flex items-center gap-2 mb-6">
        <Trophy size={18} className="text-amber-400" />
        <h3 className="text-sm font-bold text-white uppercase tracking-[0.2em]">Nexus Progression</h3>
        <div className="flex-1 h-px bg-gradient-to-r from-amber-500/20 to-transparent" />
      </div>
      <GamifiedDashboard />
    </div>

    {/* Error Tracking Dashboard */}
    <div className="mb-12">
      <ErrorDashboard />
    </div>

    {/* VibeCoder Quality Score Dashboard */}
    <div className="mb-12">
      <VibeCoderDashboard />
    </div>

    {/* Trend & Synergy Insights */}
    <div className="mb-12">
      <TrendInsightsDashboard />
    </div>

    {/* Nexus Intelligence (Codeix & Serena) */}
    <div className="mb-12">
      <NexusIntelligenceWidget />
    </div>

    {/* Engine Optimizations */}
    <div className="mb-12">
      <div className="flex items-center gap-2 mb-6">
        <ShieldCheck size={18} className="text-emerald-400" />
        <h3 className="text-sm font-bold text-white uppercase tracking-[0.2em]">Pushed Engine Optimizations</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {ENGINE_OPTIMIZATIONS.map((opt, i) => (
          <motion.div
            key={`opt-${i}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-[#151619] border border-[#2d2e32] p-4 rounded-xl hover:border-emerald-500/30 transition-all group cursor-default"
          >
            <div className="flex justify-between items-start mb-3">
              <div className={cn('p-2 rounded bg-[#0a0a0c] border border-[#2d2e32] group-hover:border-emerald-500/20', opt.color)}>
                <opt.icon size={16} />
              </div>
              <div className="text-[10px] font-mono text-[#4a4b50] group-hover:text-emerald-500/50 transition-colors uppercase tracking-widest">
                Active
              </div>
            </div>
            <h4 className="text-xs font-bold text-white mb-1">{opt.label}</h4>
            <div className="text-lg font-bold font-mono text-emerald-400 mb-2">{opt.value}</div>
            <p className="text-[10px] text-[#8E9299] font-mono leading-relaxed">{opt.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>

    {/* Quick Actions */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
      {QUICK_ACTIONS.map((action, i) => (
        <motion.button
          key={`action-${i}`}
          whileHover={{ scale: 1.02, y: -2 }}
          onClick={() => onTabChange(action.tab)}
          className={cn(
            'bg-gradient-to-br to-transparent border border-[#2d2e32] p-4 rounded-xl text-left transition-all hover:border-[#424348]',
            action.color,
          )}
        >
          <div className="flex items-center gap-3 mb-2">
            <action.icon size={18} className="text-white" />
            <h4 className="text-sm font-medium text-white">{action.title}</h4>
          </div>
          <p className="text-[10px] text-[#8E9299] font-mono uppercase tracking-tight">{action.desc}</p>
        </motion.button>
      ))}
    </div>

    {/* Main Content Grid */}
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
      {/* Left: Charts */}
      <div className="xl:col-span-2 space-y-12 min-w-0">
        <section>
          <SectionHeader title="Growth Trajectory" icon={BarChart3} />
          <div className="bg-[#151619] border border-[#2d2e32] p-6 rounded-xl h-[240px] w-full min-w-0">
            <GrowthChart data={data.growthHistory} height={200} />
          </div>
        </section>

        <section>
          <SectionHeader title="Predictive Analysis" icon={TrendingUp} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.predictions?.map((p, i) => <PredictionCard key={`${p.category}-${i}`} prediction={p} />)}
          </div>
        </section>

        <section>
          <SectionHeader title="Open Source Intelligence" icon={Globe} />
          <OpenSourceWidget stats={data.openSourceStats} />
        </section>

        <section>
          <SectionHeader title="API Signal Stream" icon={Activity} />
          <div className="bg-[#151619] border border-[#2d2e32] rounded-xl p-4 font-mono text-[10px] space-y-2">
            {data.signals?.map((sig, i) => (
              <div key={`${sig.source}-${sig.time}-${i}`} className="flex justify-between items-center py-1 border-b border-[#1a1b1e] last:border-0">
                <div className="flex gap-4">
                  <span className="text-[#4a4b50]">{sig.time}</span>
                  <span className="text-emerald-500">[{sig.source}]</span>
                  <span className="text-[#8E9299]">{sig.signal}</span>
                </div>
                <span className="text-emerald-500/50">{sig.value}</span>
              </div>
            ))}
            {!data.signals?.length && (
              <div className="text-[#4a4b50] italic py-2">Waiting for next signal cycle...</div>
            )}
          </div>
        </section>

        {data.harvestSources && <HarvestIntelligenceWidget sources={data.harvestSources} />}
      </div>

      {/* Right: Feed */}
      <div className="space-y-8">
        {data.synergyInsights && (
          <section>
            <SectionHeader title="Synergy Discovery" icon={Zap} />
            <SynergyInsightsWidget insights={data.synergyInsights} />
          </section>
        )}
        <section className="bg-[#151619]/50 border border-[#2d2e32] p-6 rounded-xl flex flex-col h-full sticky top-24">
          <SectionHeader title="Analysis Feed" icon={Activity} />
          <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar max-h-[600px]">
            {data.news?.map((item) => <NewsCard key={item.id} item={item} />)}
          </div>
        </section>
      </div>
    </div>
  </>
  );
};
