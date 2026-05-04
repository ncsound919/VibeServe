/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { Bot, TrendingUp, Zap, AlertCircle } from 'lucide-react';

export function AgentEvalTab() {
  return (
    <div className="h-full flex flex-col bg-slate-900 p-6">
      <div className="flex items-center gap-3 mb-6">
        <Bot className="w-6 h-6 text-blue-400" />
        <h1 className="text-xl font-semibold text-white">Agent Evaluation</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-slate-400">Success Rate</span>
          </div>
          <p className="text-2xl font-bold text-white">--</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-slate-400">Avg Latency</span>
          </div>
          <p className="text-2xl font-bold text-white">--ms</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span className="text-sm text-slate-400">Failures</span>
          </div>
          <p className="text-2xl font-bold text-white">0</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-slate-500">
          <Bot className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg">No evaluations recorded yet</p>
          <p className="text-sm mt-2">Run agent tasks to see evaluation metrics</p>
        </div>
      </div>
    </div>
  );
}