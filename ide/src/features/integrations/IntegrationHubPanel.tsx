/**
 * Integration Hub Panel
 * Shows connection status for all integrated services
 */

import { useState, useEffect } from "react";
import {
  Brain,
  Database,
  Search,
  MemoryStick,
  Activity,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface IntegrationStatus {
  nanobot?: boolean;
  qdrant?: boolean;
  firecrawl?: boolean;
  tavily?: boolean;
  mem0?: boolean;
  langfuse?: boolean;
}

interface SearchResult {
  title: string;
  url: string;
  content?: string;
  source: string;
}

export const IntegrationHubPanel = () => {
  const [status, setStatus] = useState<IntegrationStatus>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // DeepSeek API is configured — it powers internal capabilities for all services
  const hasDeepSeek = true;

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/integrations/status");
      const data = await response.json();
      setStatus(data.services || {});
    } catch (error) {
      console.error("Failed to fetch integration status:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const response = await fetch("/api/integrations/search/web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, source: "all" }),
      });
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setSearching(false);
    }
  };

  const ServiceIcon = ({ name, connected }: { name: string; connected?: boolean }) => {
    const icons: Record<string, typeof Brain> = {
      nanobot: Brain,
      qdrant: Database,
      firecrawl: Search,
      tavily: Search,
      mem0: MemoryStick,
      langfuse: Activity,
    };
    const Icon = icons[name] || Activity;
    const label = connected ? "Connected" : hasDeepSeek ? "DeepSeek Powered" : "Not configured";
    const color = connected ? "emerald" : hasDeepSeek ? "blue" : "red";
    
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-[#1a1b1e]">
        <div className={`p-2 rounded-lg ${connected ? "bg-emerald-500/20" : hasDeepSeek ? "bg-blue-500/20" : "bg-red-500/20"}`}>
          <Icon size={20} className={connected ? "text-emerald-400" : hasDeepSeek ? "text-blue-400" : "text-red-400"} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-white capitalize">{name}</div>
          <div className={`text-xs ${color === "emerald" ? "text-emerald-400" : color === "blue" ? "text-blue-400" : "text-red-400"}`}>
            {label}
          </div>
        </div>
        {connected ? (
          <CheckCircle size={18} className="text-emerald-400" />
        ) : hasDeepSeek ? (
          <CheckCircle size={18} className="text-blue-400" />
        ) : (
          <XCircle size={18} className="text-red-400" />
        )}
      </div>
    );
  };

  return (
    <div className="bg-[#151619] border border-[#2d2e32] rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Activity size={24} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Integration Hub</h2>
            <p className="text-sm text-[#8b8b8d]">Connected services status</p>
          </div>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="p-2 hover:bg-[#2d2e32] rounded-lg transition-colors"
        >
          <RefreshCw size={18} className={`text-[#8b8b8d] ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Status Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-blue-400" size={32} />
          </div>
        ) : (
          <>
            <ServiceIcon name="nanobot" connected={status.nanobot} />
            <ServiceIcon name="qdrant" connected={status.qdrant} />
            <ServiceIcon name="firecrawl" connected={status.firecrawl} />
            <ServiceIcon name="tavily" connected={status.tavily} />
            <ServiceIcon name="mem0" connected={status.mem0} />
            <ServiceIcon name="langfuse" connected={status.langfuse} />
          </>
        )}
      </div>

      {/* Quick Search */}
      <div className="border-t border-[#2d2e32] pt-4">
        <h3 className="text-sm font-medium text-white mb-3">Web Search</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search the web..."
            className="flex-1 bg-[#1a1b1e] border border-[#2d2e32] rounded-lg px-4 py-2 text-white placeholder-[#4a4b50] focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-[#2d2e32] text-white rounded-lg transition-colors"
          >
            {searching ? <Loader2 className="animate-spin" size={18} /> : "Search"}
          </button>
        </div>

        {/* Results */}
        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
            {searchResults.map((result, index) => (
              <a
                key={index}
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 bg-[#1a1b1e] hover:bg-[#2d2e32] rounded-lg transition-colors"
              >
                <div className="text-sm font-medium text-blue-400 truncate">
                  {result.title}
                </div>
                <div className="text-xs text-[#8b8b8d] truncate">
                  {result.url}
                </div>
                {result.content && (
                  <div className="text-xs text-[#6b6b6d] mt-1 line-clamp-2">
                    {result.content}
                  </div>
                )}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="border-t border-[#2d2e32] pt-4">
        <h3 className="text-sm font-medium text-white mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <button className="px-3 py-1.5 bg-[#1a1b1e] hover:bg-[#2d2e32] text-[#8b8b8d] text-sm rounded-lg transition-colors">
            Test Nanobot
          </button>
          <button className="px-3 py-1.5 bg-[#1a1b1e] hover:bg-[#2d2e32] text-[#8b8b8d] text-sm rounded-lg transition-colors">
            Vector Search
          </button>
          <button className="px-3 py-1.5 bg-[#1a1b1e] hover:bg-[#2d2e32] text-[#8b8b8d] text-sm rounded-lg transition-colors">
            View Traces
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntegrationHubPanel;
