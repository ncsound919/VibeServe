import { useState, useEffect, useCallback, useRef } from "react";
import { BookOpen, FileText, RefreshCw, Search, AlertTriangle, PlayCircle, RotateCcw, Loader2 } from "lucide-react";
import { SectionHeader } from "../components/SectionHeader";

interface WikiPage {
  slug: string;
  title: string;
  content: string;
  tags: string[];
  related: string[];
  createdAt: string;
  updatedAt: string;
  source: string;
}

interface AutoresearchRecord {
  iteration: number;
  timestamp: string;
  pipelineId: string;
  status: string;
  e2ePassRate: number;
  evalScore: number;
  improvement: string;
}

export const LLMWikiTab = () => {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<WikiPage | null>(null);
  const [stats, setStats] = useState({ pageCount: 0, rawCount: 0, indexExists: false });
  const [loading, setLoading] = useState(true);
  const [compiling, setCompiling] = useState(false);
  const [lintResults, setLintResults] = useState<Array<{ page: string; issues: Array<{ severity: string; message: string }> }>>([]);
  const [autoStatus, setAutoStatus] = useState<{
    enabled: boolean; currentIteration: number; maxIterations: number; passThreshold: number; history: AutoresearchRecord[];
  } | null>(null);
  const [autoRunning, setAutoRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchWiki = useCallback(async () => {
    try {
      const res = await fetch("/api/wiki");
      if (!res.ok) throw new Error(`Wiki fetch failed: ${res.status}`);
      const data = await res.json();
      setPages(data.pages ?? []);
      setStats(data.stats ?? { pageCount: 0, rawCount: 0, indexExists: false });
    } catch { /* server may not be running */ }
    setLoading(false);
  }, []);

  const fetchAutoStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/autoresearch/status");
      if (!res.ok) throw new Error(`Autoresearch status failed: ${res.status}`);
      setAutoStatus(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchWiki();
    fetchAutoStatus();
  }, [fetchWiki, fetchAutoStatus]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const handleCompileAll = async () => {
    setCompiling(true);
    try {
      const res = await fetch("/api/wiki/compile-all", { method: "POST" });
      const data = await res.json();
      await fetchWiki();
    } catch { /* ignore */ }
    setCompiling(false);
  };

  const handleLint = async () => {
    try {
      const res = await fetch("/api/wiki/lint");
      const data = await res.json();
      setLintResults(data.results ?? []);
    } catch { /* ignore */ }
  };

  const handleStartAutoresearch = async () => {
    setAutoRunning(true);
    try {
      await fetch("/api/autoresearch/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxIterations: 3 }),
      });
      // Poll for status
      const intervalId = setInterval(async () => {
        await fetchAutoStatus();
        const s = await fetch("/api/autoresearch/status").then(r => r.json());
        if (!s.enabled) {
          clearInterval(intervalId);
          setAutoRunning(false);
          await fetchWiki();
        }
      }, 2000);
      intervalRef.current = intervalId;
    } catch {
      setAutoRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-emerald-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <SectionHeader title="LLM Wiki" icon={BookOpen} />
          <p className="text-[10px] font-mono text-[#4a4b50] pl-6 uppercase tracking-wider">
            Karpathy-style persistent knowledge base · {stats.pageCount} pages · {stats.rawCount} raw sources
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleLint}
            className="flex items-center gap-2 px-3 py-1.5 border border-[#2d2e32] rounded hover:bg-[#1a1b1e] text-xs font-mono text-[#8E9299] transition-colors"
          >
            <Search size={12} />
            Lint Wiki
          </button>
          <button
            onClick={handleCompileAll}
            disabled={compiling}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded text-xs transition-all disabled:opacity-50"
          >
            <RefreshCw size={12} className={compiling ? "animate-spin" : ""} />
            {compiling ? "Compiling..." : "Compile All"}
          </button>
        </div>
      </div>

      {/* Autoresearch Section */}
      <div className="bg-[#151619] border border-[#2d2e32] p-4 rounded-xl">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <PlayCircle size={16} className="text-blue-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-widest">Autoresearch Loop</h3>
          </div>
          <button
            onClick={handleStartAutoresearch}
            disabled={autoRunning}
            className="flex items-center gap-2 px-3 py-1 bg-blue-500 hover:bg-blue-400 text-black font-bold rounded text-xs transition-all disabled:opacity-50"
          >
            {autoRunning ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
            {autoRunning ? "Running..." : "Start Loop"}
          </button>
        </div>
        {autoStatus && autoStatus.history.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {autoStatus.history.slice(-4).map((r) => (
              <div key={r.iteration} className="bg-[#0a0a0c] border border-[#1a1b1e] p-3 rounded-lg">
                <div className="text-[9px] font-mono text-[#4a4b50] uppercase">Iteration {r.iteration}</div>
                <div className="text-xs font-mono text-emerald-400 mt-1">Score: {(r.evalScore * 100).toFixed(0)}%</div>
                <div className="text-[9px] text-[#8E9299] mt-1 truncate">{r.improvement.slice(0, 60)}</div>
              </div>
            ))}
          </div>
        )}
        {(!autoStatus || autoStatus.history.length === 0) && (
          <p className="text-[10px] font-mono text-[#4a4b50]">No loops run yet. Start an autonomous iteration to evaluate and improve the pipeline.</p>
        )}
      </div>

      {/* Lint Results */}
      {lintResults.length > 0 && (
        <div className="bg-[#151619] border border-amber-500/30 p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-amber-400" />
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-widest">Lint Results</h3>
          </div>
          <div className="space-y-2">
            {lintResults.map((r) => (
              <div key={r.page} className="text-[10px] font-mono">
                <span className="text-white">{r.page}</span>
                {r.issues.map((issue, i) => (
                  <div key={i} className="pl-4 text-[#8E9299]">
                    [{issue.severity}] {issue.message}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Page Index */}
        <div className="lg:col-span-1 bg-[#151619] border border-[#2d2e32] rounded-xl p-4 h-fit sticky top-24 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <h3 className="text-[10px] font-mono uppercase text-[#4a4b50] tracking-widest mb-3">Wiki Index</h3>
          {pages.length === 0 && (
            <p className="text-[10px] font-mono text-[#4a4b50] italic">No wiki pages yet. Run Compile All to generate from pipeline results.</p>
          )}
          <div className="space-y-1">
            {pages.map((page) => (
              <button
                key={page.slug}
                onClick={() => setSelectedPage(page)}
                className={`w-full text-left p-2 rounded text-[11px] font-mono transition-colors ${
                  selectedPage?.slug === page.slug
                    ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500"
                    : "text-[#8E9299] hover:bg-[#1a1b1e] hover:text-white border-l-2 border-transparent"
                }`}
              >
                <div className="truncate">{page.title}</div>
                <div className="text-[8px] text-[#4a4b50] mt-0.5">{page.tags.slice(0, 3).join(", ")}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Page Content */}
        <div className="lg:col-span-3 bg-[#151619] border border-[#2d2e32] rounded-xl p-6 min-h-[400px]">
          {selectedPage ? (
            <div className="font-mono">
              <div className="flex items-center gap-2 mb-4 text-[10px] text-[#4a4b50]">
                <FileText size={12} />
                <span>{selectedPage.slug}.md</span>
                <span className="ml-auto">Source: {selectedPage.source}</span>
              </div>
              <div className="prose prose-invert max-w-none prose-sm">
                {selectedPage.content.split("\n").map((line, i) => {
                  if (line.startsWith("# ")) return <h1 key={i} className="text-lg font-bold text-white mb-4 mt-0">{line.replace("# ", "")}</h1>;
                  if (line.startsWith("## ")) return <h2 key={i} className="text-base font-bold text-emerald-400 mt-6 mb-2">{line.replace("## ", "")}</h2>;
                  if (line.startsWith("### ")) return <h3 key={i} className="text-sm font-bold text-[#8E9299] mt-4 mb-1">{line.replace("### ", "")}</h3>;
                  if (line.startsWith("- ")) return <li key={i} className="text-[11px] text-[#A1A1AA] ml-4 list-disc">{line.replace("- ", "")}</li>;
                  if (line.startsWith("> ")) return <blockquote key={i} className="text-[11px] text-[#4a4b50] italic border-l-2 border-[#2d2e32] pl-3 my-2">{line.replace("> ", "")}</blockquote>;
                  if (line.startsWith("tags:")) return null;
                  if (line.startsWith("---")) return null;
                  if (line.trim() === "") return <div key={i} className="h-2" />;
                  // Safely render markdown links without dangerouslySetInnerHTML
                  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
                  if (linkRegex.test(line)) {
                    linkRegex.lastIndex = 0;
                    const parts: Array<{ text: string; href?: string }> = [];
                    let lastIdx = 0;
                    let match;
                    while ((match = linkRegex.exec(line)) !== null) {
                      if (match.index > lastIdx) {
                        parts.push({ text: line.slice(lastIdx, match.index) });
                      }
                      parts.push({ text: match[1], href: match[2] });
                      lastIdx = linkRegex.lastIndex;
                    }
                    if (lastIdx < line.length) {
                      parts.push({ text: line.slice(lastIdx) });
                    }
                    return (
                      <p key={i} className="text-[11px] text-[#A1A1AA] leading-relaxed">
                        {parts.map((p, j) =>
                          p.href ? (
                            <a key={j} href={p.href} className="text-emerald-400 underline hover:text-emerald-300" target="_blank" rel="noopener noreferrer">{p.text}</a>
                          ) : (
                            <span key={j}>{p.text}</span>
                          )
                        )}
                      </p>
                    );
                  }
                  return <p key={i} className="text-[11px] text-[#A1A1AA] leading-relaxed">{line}</p>;
                })}
              </div>
              {selectedPage.related.length > 0 && (
                <div className="mt-8 pt-4 border-t border-[#2d2e32]">
                  <h4 className="text-[10px] font-mono uppercase text-[#4a4b50] tracking-widest mb-2">Related Pages</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedPage.related.map((rel) => {
                      const relPage = pages.find((p) => p.slug === rel);
                      return (
                        <button
                          key={rel}
                          onClick={() => relPage && setSelectedPage(relPage)}
                          className="text-[10px] font-mono px-2 py-1 bg-[#1a1b1e] border border-[#2d2e32] rounded text-emerald-400 hover:bg-[#2d2e32] transition-colors"
                        >
                          {relPage?.title ?? rel}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[#4a4b50]">
              <BookOpen size={48} className="mb-4 opacity-30" />
              <p className="text-xs font-mono">Select a wiki page from the index</p>
              <p className="text-[10px] font-mono mt-2">Pages are compiled by DeepSeek from pipeline artifacts</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
