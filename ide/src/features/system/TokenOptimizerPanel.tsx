import { useState, useEffect } from 'react';
import { Zap, Gauge, Database, Cpu, TrendingDown, Settings, RefreshCw, Check, X } from 'lucide-react';
import { getOptimizerStats, getOptimizerConfig, setOptimizerConfig, resetOptimizerStats } from '../../services/tokenOptimizer';
import { getToonStats } from '../../services/toonService';
import { getGraph } from '../../services/graphifyService';
import { getCostRouter } from '../../core/agents/runtime/costRouter';
import { useCostRouter } from '../../core/agents/runtime/costRouter';

export function TokenOptimizerPanel() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings' | 'methods'>('dashboard');
  const [stats, setStats] = useState(getOptimizerStats());
  const [toonStats, setToonStats] = useState(getToonStats());
  const [config, setConfig] = useState(getOptimizerConfig());
  const [graph, setGraph] = useState(getGraph());

  const costRouter = useCostRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(getOptimizerStats());
      setToonStats(getToonStats());
      setConfig(getOptimizerConfig());
      setGraph(getGraph());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const totalTokenSavings = stats.totalTokensSaved + toonStats.totalSavedTokens;
  const estimatedCostSavings = (totalTokenSavings / 1000) * 0.001;

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] text-gray-300">
      <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-white">Token Optimizer</span>
          <span className="px-1.5 py-0.5 bg-amber-900/50 text-amber-300 text-xs rounded">
            {stats.totalPrompts} prompts
          </span>
        </div>
        <button
          onClick={resetOptimizerStats}
          className="p-1.5 hover:bg-gray-800 rounded"
          title="Reset stats"
        >
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div className="flex border-b border-gray-800">
        {(['dashboard', 'settings', 'methods'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm capitalize ${activeTab === tab ? 'text-white border-b-2 border-amber-400' : 'text-gray-400 hover:text-gray-300'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#252526] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-gray-400">Total Tokens Saved</span>
                </div>
                <div className="text-2xl font-bold text-white">{totalTokenSavings.toLocaleString()}</div>
                <div className="text-xs text-gray-500">~${estimatedCostSavings.toFixed(4)} value</div>
              </div>

              <div className="bg-[#252526] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Gauge className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-gray-400">Avg Savings %</span>
                </div>
                <div className="text-2xl font-bold text-white">{stats.averageSavingsPercent}%</div>
                <div className="text-xs text-gray-500">per prompt</div>
              </div>
            </div>

            <div className="bg-[#252526] rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-3">Optimization Methods</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span className="text-sm">AutoCoder (Templates)</span>
                  </div>
                  <span className="text-emerald-400">{stats.autocoderHits} uses</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-purple-400" />
                    <span className="text-sm">Toon (Compression)</span>
                  </div>
                  <span className="text-emerald-400">{stats.toonCompressionCount} uses</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-400" />
                    <span className="text-sm">Graphify (Knowledge Graph)</span>
                  </div>
                  <span className="text-emerald-400">{stats.graphifyQueries} queries</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-sm">Cache Hits</span>
                  </div>
                  <span className="text-emerald-400">{stats.cacheHits} hits</span>
                </div>
              </div>
            </div>

            <div className="bg-[#252526] rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-3">Toon Compression Stats</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-400">Total Calls</div>
                  <div className="text-lg text-white">{toonStats.totalCalls}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Applied</div>
                  <div className="text-lg text-white">{toonStats.totalApplied}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Original Tokens</div>
                  <div className="text-lg text-white">{toonStats.totalOriginalTokens}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Saved Tokens</div>
                  <div className="text-lg text-emerald-400">{toonStats.totalSavedTokens}</div>
                </div>
              </div>
            </div>

            {graph && (
              <div className="bg-[#252526] rounded-lg p-4">
                <h4 className="text-sm font-medium text-white mb-3">Graphify Knowledge Graph</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-xs text-gray-400">Nodes</div>
                    <div className="text-lg text-white">{graph.nodes.length}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Edges</div>
                    <div className="text-lg text-white">{graph.edges.length}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Communities</div>
                    <div className="text-lg text-white">{graph.communities.length}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-[#252526] rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-3">Cost Router</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Total Spend</span>
                  <span className="text-white">${costRouter.metrics.totalSpend.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Tokens Used (In/Out)</span>
                  <span className="text-white">
                    {costRouter.metrics.tokensUsed.input.toLocaleString()} / {costRouter.metrics.tokensUsed.output.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Budget Mode</span>
                  <span className={`px-2 py-0.5 text-xs rounded ${
                    costRouter.metrics.budgetMode === 'normal' ? 'bg-emerald-900 text-emerald-300' :
                    costRouter.metrics.budgetMode === 'throttle' ? 'bg-yellow-900 text-yellow-300' :
                    'bg-red-900 text-red-300'
                  }`}>
                    {costRouter.metrics.budgetMode}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div className="bg-[#252526] rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Optimization Settings
              </h4>
              <div className="space-y-3">
                <ToggleSetting
                  label="Enable Toon Compression"
                  description="Compress JSON using TOON format"
                  enabled={config.enableToon}
                  onChange={(v) => setOptimizerConfig({ enableToon: v })}
                />
                <ToggleSetting
                  label="Enable Graphify Context"
                  description="Use knowledge graph for codebase queries"
                  enabled={config.enableGraphify}
                  onChange={(v) => setOptimizerConfig({ enableGraphify: v })}
                />
                <ToggleSetting
                  label="Enable AutoCoder"
                  description="Use templates for boilerplate code"
                  enabled={config.enableAutocoder}
                  onChange={(v) => setOptimizerConfig({ enableAutocoder: v })}
                />
                <ToggleSetting
                  label="Enable Prompt Caching"
                  description="Cache repeated prompts"
                  enabled={config.enableCaching}
                  onChange={(v) => setOptimizerConfig({ enableCaching: v })}
                />
              </div>
            </div>

            <div className="bg-[#252526] rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-3">Thresholds</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400">Min Savings Threshold (%)</label>
                  <input
                    type="number"
                    value={config.minSavingsThreshold}
                    onChange={(e) => setOptimizerConfig({ minSavingsThreshold: parseInt(e.target.value) })}
                    className="w-full mt-1 bg-[#1e1e1e] border border-gray-700 rounded px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Cache TTL (ms)</label>
                  <input
                    type="number"
                    value={config.cacheTtlMs}
                    onChange={(e) => setOptimizerConfig({ cacheTtlMs: parseInt(e.target.value) })}
                    className="w-full mt-1 bg-[#1e1e1e] border border-gray-700 rounded px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'methods' && (
          <div className="space-y-4">
            <div className="bg-[#252526] rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-amber-900/50 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-white">AutoCoder (100% Savings)</h4>
                  <p className="text-xs text-gray-400">Deterministic template-based code generation</p>
                </div>
              </div>
              <p className="text-sm text-gray-400">
                Uses predefined templates to generate boilerplate code (CRUD, React components, TypeScript interfaces, tests, etc.) without calling LLM. Saves 100% of tokens for applicable patterns.
              </p>
            </div>

            <div className="bg-[#252526] rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-purple-900/50 rounded-lg flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-white">Toon (30-60% Savings)</h4>
                  <p className="text-xs text-gray-400">Token-Oriented Object Notation</p>
                </div>
              </div>
              <p className="text-sm text-gray-400">
                Compresses JSON data by replacing verbose keys with abbreviations (e.g., "description" → "d", "createdAt" → "ca") and using YAML-like format. Reduces token count by 30-60%.
              </p>
            </div>

            <div className="bg-[#252526] rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-900/50 rounded-lg flex items-center justify-center">
                  <Database className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-white">Graphify (71.5x Reduction)</h4>
                  <p className="text-xs text-gray-400">Knowledge Graph Context</p>
                </div>
              </div>
              <p className="text-sm text-gray-400">
                Instead of reading entire files, queries a compact knowledge graph to understand codebase structure. For 1000 LOC, reduces from ~500 tokens to ~7 tokens using graph queries.
              </p>
            </div>

            <div className="bg-[#252526] rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-900/50 rounded-lg flex items-center justify-center">
                  <Check className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-white">Prompt Caching</h4>
                  <p className="text-xs text-gray-400">LRU Cache for Repeated Queries</p>
                </div>
              </div>
              <p className="text-sm text-gray-400">
                Stores responses to repeated prompts in an LRU cache. Subsequent identical prompts return cached responses at 0 token cost.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleSetting({ label, description, enabled, onChange }: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm text-white">{label}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-emerald-600' : 'bg-gray-700'}`}
      >
        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}
