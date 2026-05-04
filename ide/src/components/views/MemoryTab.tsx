import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Brain, Database, Cpu, Network, AlertCircle, 
  RefreshCw, Trash2, Search, BarChart3, Eye, 
  Clock, Zap, TrendingUp, Activity
} from 'lucide-react';
import { useMemoryStore } from '../core/agents/memory/memoryStore';
import type { MemoryTier, Memory } from '../core/agents/memory/memoryTypes';

const tierIcons: Record<MemoryTier, React.ReactNode> = {
  episodic: <Clock className="w-4 h-4" />,
  semantic: <Database className="w-4 h-4" />,
  procedural: <Cpu className="w-4 h-4" />,
  graph: <Network className="w-4 h-4" />,
  'error-solutions': <AlertCircle className="w-4 h-4" />,
};

const tierColors: Record<MemoryTier, string> = {
  episodic: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
  semantic: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
  procedural: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
  graph: 'text-amber-400 bg-amber-500/20 border-amber-500/30',
  'error-solutions': 'text-red-400 bg-red-500/20 border-red-500/30',
};

export default function MemoryTab() {
  const { memories, stats, query, getStats, decayMemories, consolidate, clearTier, clearAll } = useMemoryStore();
  const [selectedTier, setSelectedTier] = useState<MemoryTier | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isConsolidating, setIsConsolidating] = useState(false);

  const filteredMemories = selectedTier === 'all' 
    ? memories 
    : memories.filter(m => m.tier === selectedTier);

  const searchResults = searchQuery 
    ? query({ query: searchQuery, limit: 50 })
    : filteredMemories;

  const handleConsolidate = async () => {
    setIsConsolidating(true);
    await new Promise(r => setTimeout(r, 1500));
    consolidate();
    setIsConsolidating(false);
  };

  const tiers: MemoryTier[] = ['episodic', 'semantic', 'procedural', 'graph', 'error-solutions'];

  return (
    <div className="flex h-full">
      <div className="w-64 border-r border-gray-800 bg-[#0f0f11] flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Brain className="w-4 h-4 text-indigo-400" />
            Memory System
          </h2>
          <p className="text-xs text-gray-500 mt-1">5-tier cognitive architecture</p>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <button
            onClick={() => setSelectedTier('all')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm mb-2 transition-colors ${
              selectedTier === 'all' ? 'bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:bg-gray-800'
            }`}
          >
            <span>All Memories</span>
            <span className="text-xs bg-gray-800 px-2 py-0.5 rounded">{stats.totalMemories}</span>
          </button>

          {tiers.map(tier => (
            <button
              key={tier}
              onClick={() => setSelectedTier(tier)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm mb-1 transition-colors ${
                selectedTier === tier ? tierColors[tier].split(' ')[0] + ' bg-opacity-20' : 'text-gray-400 hover:bg-gray-800'
              }`}
              style={{ backgroundColor: selectedTier === tier ? tierColors[tier].split(' ')[1] : undefined }}
            >
              <div className="flex items-center gap-2">
                {tierIcons[tier]}
                <span className="capitalize">{tier.replace('-', ' ')}</span>
              </div>
              <span className="text-xs bg-gray-800 px-2 py-0.5 rounded">{stats.byTier[tier]}</span>
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-gray-800 space-y-2">
          <button
            onClick={decayMemories}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-white bg-gray-800 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Decay Memories
          </button>
          <button
            onClick={handleConsolidate}
            disabled={isConsolidating}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-white bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
          >
            {isConsolidating ? <Activity className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />}
            {isConsolidating ? 'Consolidating...' : 'Consolidate'}
          </button>
          <button
            onClick={clearAll}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-red-400 hover:text-red-300 bg-red-500/10 rounded-lg transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Clear All
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search memories..."
                className="pl-9 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none w-64"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2 text-gray-400">
              <BarChart3 className="w-4 h-4" />
              <span>Avg Importance: {(stats.avgImportance * 100).toFixed(1)}%</span>
            </div>
            {stats.consolidationNeeded && (
              <div className="flex items-center gap-1 text-amber-400">
                <Zap className="w-3 h-3" />
                Consolidation Needed
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Brain className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-sm">No memories found</p>
              <p className="text-xs mt-1">Start using the agent to build memory</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {searchResults.map((memory) => (
                  <motion.div
                    key={memory.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-lg border ${tierColors[memory.tier]}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {tierIcons[memory.tier]}
                        <span className="text-xs font-medium uppercase">{memory.tier}</span>
                        <span className="text-xs text-gray-500">
                          • {memory.accessCount} accesses
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          memory.importance > 0.7 ? 'bg-emerald-500/20 text-emerald-400' :
                          memory.importance > 0.4 ? 'bg-amber-500/20 text-amber-400' :
                          'bg-gray-700 text-gray-400'
                        }`}>
                          {(memory.importance * 100).toFixed(0)}% imp.
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-300 line-clamp-2">{memory.content}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(memory.timestamp).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        Last: {new Date(memory.lastAccessed).toLocaleTimeString()}
                      </span>
                    </div>
                    {memory.tags.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {memory.tags.slice(0, 5).map(tag => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-800 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
