/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { Cpu, Bot, Upload } from 'lucide-react';
import { SectionHeader } from '../../components/SectionHeader';
import type { CustomAgentData } from '../../types';

interface AgentForgeProps {
  agents: CustomAgentData[];
  onUpload: () => void;
}

export const AgentForge = ({ agents, onUpload }: AgentForgeProps) => (
  <div className="bg-[#151619] border border-[#2d2e32] rounded-xl p-6">
    <div className="flex justify-between items-center mb-6">
      <SectionHeader title="Agent Forge" icon={Cpu} />
      <button
        onClick={onUpload}
        className="text-[10px] bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-400 font-mono flex items-center gap-2"
      >
        <Upload size={12} /> UPLOAD_AGENT_FOLDER
      </button>
    </div>

    <div className="space-y-4">
      {agents.map(agent => (
        <motion.div
          key={agent.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-[#0a0a0c] border border-[#1a1b1e] rounded-lg group hover:border-blue-500/30 transition-all"
        >
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded text-blue-400">
                <Bot size={16} />
              </div>
              <div>
                <h4 className="text-sm text-white font-medium">{agent.name}</h4>
                <p className="text-[10px] font-mono text-[#4a4b50] uppercase tracking-wider">
                  {agent.type} • {agent.status}
                </p>
              </div>
            </div>
            <span className="text-[9px] font-mono text-[#4a4b50]">
              {new Date(agent.lastActive).toLocaleTimeString()}
            </span>
          </div>
          {agent.analysis && (
            <p className="text-[11px] text-[#8E9299] font-mono mt-3 leading-relaxed border-l-2 border-blue-500/20 pl-3">
              {agent.analysis}
            </p>
          )}
        </motion.div>
      ))}
      {agents.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed border-[#1a1b1e] rounded-xl">
          <Upload className="mx-auto text-[#2d2e32] mb-2" size={24} />
          <p className="text-xs text-[#4a4b50] font-mono uppercase tracking-widest">
            Awaiting local agent protocols...
          </p>
        </div>
      )}
    </div>
  </div>
);
