/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Search, Terminal } from 'lucide-react';
import { SectionHeader } from '../components/SectionHeader';
import { NexusBrowser } from '../features/browser/NexusBrowser';
import { BrowserHarnessPanel } from '../features/browser/BrowserHarnessPanel';
import type { PipelineExecutionData } from '../types';
import { cn } from '../lib/utils';

interface NexusBrowserTabProps {
  browserContext?: string;
  activeRun?: PipelineExecutionData | null;
}

type ViewMode = 'agent' | 'harness';

export const NexusBrowserTab = ({ browserContext, activeRun }: NexusBrowserTabProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('agent');

  return (
    <div className="h-[calc(100vh-160px)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="Agentic Browsing Interface" icon={Search} />
        <div className="flex items-center gap-2 bg-[#151619] border border-[#2d2e32] rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('agent')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono rounded-md transition-all',
              viewMode === 'agent'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-[#4a4b50] hover:text-white',
            )}
          >
            <Search size={10} />
            AGENT BROWSER
          </button>
          <button
            onClick={() => setViewMode('harness')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono rounded-md transition-all',
              viewMode === 'harness'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-[#4a4b50] hover:text-white',
            )}
          >
            <Terminal size={10} />
            HARNESS TERMINAL
          </button>
        </div>
      </div>

      {viewMode === 'agent' ? (
        <NexusBrowser initialMessage={browserContext} activeRun={activeRun} />
      ) : (
        <div className="flex-1 min-h-0">
          <BrowserHarnessPanel />
        </div>
      )}
    </div>
  );
};
