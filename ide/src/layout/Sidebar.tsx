import { useState, type ElementType } from 'react';
import {
  Sparkles, BarChart3, Terminal, Activity, Zap, History, Settings,
  ChevronDown, ChevronRight, LayoutDashboard, Workflow,
  Shield, Brain, FileCode, GitCompare, Database, Eye, Package, Cpu,
  Wand2, Trophy, ClipboardList,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { SystemManifest } from './SystemManifest';

// Re-export TabName from the store (source of truth) for backward compatibility
export type { TabName } from '../stores/useAppStore';
import type { TabName } from '../stores/useAppStore';

const PRIMARY_ITEMS: { icon: ElementType; label: TabName }[] = [
  { icon: Sparkles, label: 'Composer' },
  { icon: FileCode, label: 'Editor' },
  { icon: ClipboardList, label: 'Review' },
  { icon: Wand2, label: 'Magic' },
  { icon: Database, label: 'Memory' },
  { icon: Eye, label: 'Preview' },
];

const ADVANCED_ITEMS: { icon: ElementType; label: TabName }[] = [
  { icon: BarChart3, label: 'Overview' },
  { icon: Activity, label: 'Pipeline' },
  { icon: Zap, label: 'Activity' },
  { icon: History, label: 'History' },
  { icon: Shield, label: 'Audit' },
  { icon: Brain, label: 'Mission Control' },
  { icon: GitCompare, label: 'Changes' },
  { icon: Terminal, label: 'Command Center' },
  { icon: Settings, label: 'Settings' },
  { icon: Package, label: 'Extensions' },
  { icon: Cpu, label: 'System' },
  { icon: Trophy, label: 'Agent Eval' },
];

interface SidebarProps {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
}

export const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <aside className="w-20 lg:w-64 border-r border-[#1a1b1e] min-h-[calc(100vh-64px)] hidden md:flex flex-col" role="navigation" aria-label="Main navigation">
      <nav className="p-4 flex flex-col gap-1 flex-1">
        {PRIMARY_ITEMS.map((item) => (
          <button
            key={item.label}
            id={`nav-item-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            aria-label={item.label}
            aria-current={activeTab === item.label ? 'page' : undefined}
            onClick={() => onTabChange(item.label)}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg transition-all group focus-visible:ring-2 focus-visible:ring-emerald-500/50',
              activeTab === item.label
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'text-[#9CA3AF] hover:bg-[#151619] hover:text-white',
            )}
          >
            <item.icon size={20} />
            <span className="hidden lg:block text-sm font-medium">{item.label}</span>
          </button>
        ))}

        <button
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className={cn(
            'flex items-center gap-3 p-3 rounded-lg transition-all group mt-2 text-[#6B7280] hover:text-[#9CA3AF] hover:bg-[#151619] focus-visible:ring-2 focus-visible:ring-emerald-500/50',
          )}
          aria-expanded={advancedOpen}
          aria-controls="advanced-nav-items"
          aria-label="Toggle advanced navigation"
        >
          {advancedOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span className="hidden lg:block text-xs font-semibold uppercase tracking-wider">Advanced</span>
        </button>

        {advancedOpen && ADVANCED_ITEMS.map((item) => (
          <button
            key={item.label}
            id={`nav-item-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            aria-label={item.label}
            aria-current={activeTab === item.label ? 'page' : undefined}
            onClick={() => onTabChange(item.label)}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg transition-all group focus-visible:ring-2 focus-visible:ring-emerald-500/50',
              activeTab === item.label
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'text-[#9CA3AF] hover:bg-[#151619] hover:text-white',
            )}
          >
            <item.icon size={20} />
            <span className="hidden lg:block text-sm font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
      <SystemManifest />
    </aside>
  );
};
