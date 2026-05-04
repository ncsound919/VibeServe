/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Terminal as TerminalIcon, Cpu, CheckCircle2, Box, Zap } from 'lucide-react';
import { SectionHeader } from '../components/SectionHeader';
import { CLITerminal } from '../features/cli/CLITerminal';
import { MCPBridgeStatus } from '../features/mcp/MCPBridgeStatus';
import { AgentForge } from '../features/agents/AgentForge';
import { IntegrationHubPanel } from '../features/integrations/IntegrationHubPanel';
import type { DashboardData, CLIStateData } from '../types';

interface CommandCenterTabProps {
  data: DashboardData;
  onCommand: (cmd: string) => void;
  onProviderChange: (provider: CLIStateData['activeProvider']) => void;
  onAgentUpload: () => void;
  latency?: number;
}

export const CommandCenterTab = ({
  data,
  onCommand,
  onProviderChange,
  onAgentUpload,
}: CommandCenterTabProps) => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <div className="lg:col-span-2 space-y-8">
      <section>
        <div className="flex justify-between items-center mb-6">
          <SectionHeader title="Protocol CLI" icon={TerminalIcon} />
          <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            BRIDGE_ACTIVE: {data.cliState?.activeProvider?.toUpperCase() || 'OFFLINE'}
          </div>
        </div>
        <CLITerminal
          state={data.cliState || { activeProvider: 'opencode', output: [] }}
          onCommand={onCommand}
          onProviderChange={onProviderChange}
        />
      </section>

      {data.mcpStatus && (
        <section>
          <SectionHeader title="Distributed Context Architecture" icon={Cpu} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MCPBridgeStatus status={data.mcpStatus} latency={latency} />
            <div className="bg-[#151619] border border-[#2d2e32] rounded-xl p-6 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <h4 className="text-xs font-mono uppercase text-white tracking-widest">
                  Context Routing: Optimized
                </h4>
              </div>
              <p className="text-[11px] text-[#8E9299] font-mono leading-relaxed">
                L3 connection verified between DeepSeek-V4 and Gemini-2.0. Cross-model reasoning
                enabled via MCP protocol v1.0.0.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>

    <div className="space-y-8">
      <AgentForge agents={data.customAgents || []} onUpload={onAgentUpload} />

      {/* Integration Hub - New */}
      <IntegrationHubPanel />

      <section className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Box size={18} className="text-emerald-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">DeepSeek-V4 Integration</h3>
        </div>
        <p className="text-xs text-[#8E9299] font-mono leading-relaxed mb-4">
          DeepSeek-V4 and DeepSeek-R1 (Reasoning) are currently ACTIVE. Ultra-low latency semantic
          scans are routed through the Nexus-Alpha gateway.
        </p>
        <div className="space-y-2 mb-6">
          {[
            { label: 'API_GATEWAY', value: 'CONNECTED', color: 'text-emerald-500' },
            { label: 'COMPUTE_RESOURCES', value: 'AVAILABLE', color: 'text-white' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between text-[10px] font-mono uppercase">
              <span className="text-[#4a4b50]">{label}</span>
              <span className={color}>{value}</span>
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-4">
          <h4 className="text-[10px] font-mono uppercase text-[#4a4b50] tracking-widest border-b border-emerald-500/10 pb-1 flex items-center gap-2">
            <Zap size={10} className="text-emerald-500" /> Live Reasoning Chain
          </h4>
          <div className="space-y-3">
            {['Intent Extraction', 'Multi-Model Consensus', 'Context Injection (MCP)'].map((step) => (
              <div key={step} className="flex items-center justify-between text-[9px] font-mono">
                <span className="text-[#8E9299]">{step}</span>
                <span className="text-emerald-500 uppercase">ok</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  </div>
);
