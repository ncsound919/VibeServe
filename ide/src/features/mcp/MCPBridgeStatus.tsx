/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Cpu } from 'lucide-react';
import type { DashboardData } from '../../types';

interface MCPBridgeStatusProps {
  status: DashboardData['mcpStatus'];
  latency?: number;
}

export const MCPBridgeStatus = ({ status }: MCPBridgeStatusProps) => (
  <div className="bg-[#151619] border border-blue-500/20 rounded-xl p-6 relative overflow-hidden group">
    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
      <Cpu size={64} className="text-blue-400" />
    </div>
    <div className="flex items-center gap-2 mb-6">
      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
      <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">MCP Bridge Active</h3>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1">
        <div className="text-[10px] text-[#4a4b50] font-mono uppercase">Node Servers</div>
        <div className="text-xl font-bold text-white font-mono">{status?.activeServers || 0}</div>
      </div>
      <div className="space-y-1 text-right">
        <div className="text-[10px] text-[#4a4b50] font-mono uppercase">L3 Connections</div>
        <div className="text-xl font-bold text-white font-mono">{status?.connections || 0}</div>
      </div>
      <div className="space-y-1">
        <div className="text-[10px] text-[#4a4b50] font-mono uppercase">Protocol</div>
        <div className="text-sm font-bold text-blue-400 font-mono">v{status?.protocol || '1.0.0'}</div>
      </div>
      <div className="space-y-1 text-right">
        <div className="text-[10px] text-[#4a4b50] font-mono uppercase">Latency</div>
        <div className="text-sm font-bold text-emerald-400 font-mono">{(latency ? latency / 100 : 0.14).toFixed(2)}ms</div>
      </div>
    </div>
    <div className="mt-6 pt-4 border-t border-[#2d2e32] flex justify-between items-center text-[9px] font-mono text-[#4a4b50]">
      <span>LAST_PING: {status?.lastPing ? new Date(status.lastPing).toLocaleTimeString() : 'N/A'}</span>
      <span className="text-blue-500 hover:underline cursor-pointer">RESTART_MCP</span>
    </div>
  </div>
);
