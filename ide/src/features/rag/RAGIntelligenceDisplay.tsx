/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Database } from 'lucide-react';
import type { RAGContextData } from '../../types';

interface RAGIntelligenceDisplayProps {
  rag: RAGContextData;
}

export const RAGIntelligenceDisplay = ({ rag }: RAGIntelligenceDisplayProps) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
    <div className="bg-[#0a0a0c] border border-blue-500/20 p-5 rounded-xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity">
        <Database className="text-blue-500" size={20} />
      </div>
      <div className="text-[10px] font-mono text-blue-400 uppercase tracking-widest mb-3">Knowledge Index Hub</div>
      <div className="flex items-end gap-3 mb-4">
        <div className="text-3xl font-bold text-white leading-none">{rag.indexedDocs.toLocaleString()}</div>
        <div className="text-[10px] font-mono text-[#4a4b50] pb-1 uppercase">Synced Documents</div>
      </div>
      <div className="text-[9px] font-mono text-[#4a4b50] uppercase">Last Vector Sync: {rag.lastSync}</div>
    </div>

    <div className="bg-[#0a0a0c] border border-blue-500/20 p-5 rounded-xl">
      <div className="text-[10px] font-mono text-blue-400 uppercase tracking-widest mb-3">Context Retrieval</div>
      <div className="space-y-2">
        {rag.relevantSnippets.map((snippet, i) => (
          <div key={i} className="flex gap-3 items-start group">
            <div className="w-1 h-1 rounded-full bg-blue-500/40 mt-1.5 shrink-0" />
            <p className="text-[10px] font-mono text-[#8E9299] leading-relaxed group-hover:text-blue-200 transition-colors">
              {snippet}
            </p>
          </div>
        ))}
      </div>
    </div>
  </div>
);
