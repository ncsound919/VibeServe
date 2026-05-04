import { useState, useRef, type ChangeEvent } from 'react';
import { Activity, Search, PlayCircle, Upload, FolderUp, Gauge, Network, Cpu, GitBranch, Plus, Check, Loader2, Shield, Brain, Wrench, ArrowRight } from 'lucide-react';
import { SectionHeader } from '../components/SectionHeader';
import { ActivePipelineRun } from '../features/pipeline/ActivePipelineRun';
import { PipelineVisualizer } from '../features/pipeline/PipelineVisualizer';
import { PullRequestList } from '../features/pipeline/PullRequestList';
import { usePipelineStore } from '../stores/usePipelineStore';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';
import type { PipelineExecutionData, BuildStepData, CustomAgentData, RepoTrend, AgentAssessment } from '../types';

interface PipelineTabProps {
  activeRun: PipelineExecutionData | null;
  buildPipeline: BuildStepData[];
  customAgents: CustomAgentData[];
  onReset: () => void;
  onLaunch: () => void;
  onBrowseRepos: () => void;
  trendingRepos?: RepoTrend[];
}

export const PipelineTab = ({
  activeRun,
  buildPipeline,
  customAgents,
  onReset,
  onLaunch,
  onBrowseRepos,
  trendingRepos = [],
}: PipelineTabProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadedFolders, setUploadedFolders] = useState<Array<{ id: string; name: string; fileCount: number; assessment?: AgentAssessment }>>([]);
  const [assessing, setAssessing] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [ingestedRepos, setIngestedRepos] = useState<Array<{ owner: string; repo: string; addedAt: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const startPipelineStore = usePipelineStore((s) => s.startPipeline);
  const addNotification = useWorkspaceStore((s) => s.addNotification);

  const handleIngestRepo = async (urlOverride?: string) => {
    const targetUrl = urlOverride || repoUrl;
    const match = targetUrl.match(/github\.com\/([^\/]+)\/([^\/\s.#]+)/) || targetUrl.match(/^([^\/]+)\/([^\/\s.#]+)$/);
    if (!match) return;
    
    // If it's just owner/repo format, reconstruct the URL
    const finalUrl = targetUrl.includes('github.com') ? targetUrl : `https://github.com/${targetUrl}`;
    const owner = match[1];
    const repo = match[2];
    
    setIngesting(true);
    try {
      const cloneRes = await fetch('/api/github/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: finalUrl }),
      });
      if (!cloneRes.ok) throw new Error('Clone failed: Backend service unavailable or repository not found');
      const cloned: any = await cloneRes.json();

      const cleanName = `${owner}/${repo}`;
      const wikiEntry = `# Repository: ${cleanName}\n\n**URL:** ${finalUrl}\n**Files:** ${cloned.fileCount}\n**Languages:** ${cloned.languages?.join(', ') || 'unknown'}\n**Status:** Cloned and ready for pipeline analysis\n\n## Processed Files\n${cloned.files?.slice(0, 50).map((f: any) => `- ${f.relativePath} (${Math.round(f.size / 1024)}KB)`).join('\n') || ''}\n`;
      await fetch('/api/wiki/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: `GitHub: ${cleanName}`,
          content: wikiEntry,
          metadata: { pipelineId: cleanName, repoUrl: finalUrl },
        }),
      });

      startPipelineStore([`folder:${cloned.path}`]);
      
      setRepoUrl('');
      setIngestedRepos(prev => [...prev, { owner, repo, addedAt: new Date().toISOString() }]);
    } catch (e: any) {
      console.error('Ingest failed:', e.message);
      addNotification({
        type: 'error',
        title: 'Repository Ingest Failed',
        message: e.message
      });
      setRepoUrl('');
    }
    setIngesting(false);
  };

  const handleFolderUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const text = await file.text();
      const files = JSON.parse(text);
      if (!Array.isArray(files)) throw new Error('Invalid file format');

      const res = await fetch('/api/folders/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name.replace(/\.json$/i, ''), files }),
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const data = await res.json();
      setUploadedFolders(prev => [...prev, { id: data.folderId, name: data.folderName, fileCount: data.fileCount }]);

      // Auto-assess the uploaded agent folder
      if (data.folderPath) {
        setAssessing(data.folderId);
        try {
          const assessRes = await fetch('/api/agents/assess', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath: data.folderPath }),
          });
          if (assessRes.ok) {
            const assessment: AgentAssessment = await assessRes.json();
            setUploadedFolders(prev => prev.map(f =>
              f.id === data.folderId ? { ...f, assessment } : f
            ));
          }
        } catch (assessErr) {
          console.error('Agent assessment failed:', assessErr);
        }
        setAssessing(null);
      }
    } catch (err) {
      console.error('Folder upload failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerPipelineWithFolder = (folderId: string) => {
    startPipelineStore([`folder:${folderId}`]);
  };

  return (
    <div data-testid="pipeline-tab" className="max-w-5xl">
      <div className="flex justify-between items-center mb-8">
        <SectionHeader title="Nexus Automated Pipeline" icon={Activity} />
        <div className="flex gap-4">
          <div className="px-3 py-1 bg-[#151619] border border-[#2d2e32] rounded text-[10px] font-mono text-[#4a4b50] flex items-center gap-2">
            <Cpu size={10} className="text-emerald-500" />
            WORKERS: {customAgents.length + 4} ACTIVE
          </div>
          <div className="px-3 py-1 bg-[#151619] border border-[#2d2e32] rounded text-[10px] font-mono text-[#4a4b50] flex items-center gap-2">
            <Network size={10} className="text-blue-500" />
            REGION: {import.meta.env.VITE_REGION || 'LOCAL_HOST'}
          </div>
        </div>
      </div>

      {activeRun ? (
        <ActivePipelineRun
          execution={activeRun}
          onReset={onReset}
          onLaunch={onLaunch}
          activeAgent={customAgents.find(a => a.id === activeRun.assignedAgentId)}
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-24 bg-[#151619]/30 border border-dashed border-[#2d2e32] rounded-3xl">
          <div className="w-16 h-16 bg-[#151619] border border-[#2d2e32] rounded-2xl flex items-center justify-center mb-6 text-[#4a4b50]">
            <PlayCircle size={32} />
          </div>
          <h3 className="text-white font-medium mb-2">No Active Pipeline Sessions</h3>
          <p className="text-[#8E9299] text-xs font-mono text-center max-w-xs px-8">
            Select a trending repository or upload a local folder to initialize an automated build and E2E testing sequence.
          </p>
          <div className="flex items-center gap-4 mt-8">
            <button
              onClick={onBrowseRepos}
              data-testid="pipeline-run"
              className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg transition-all text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40"
            >
              <Search size={14} />
              Browse Repositories
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-6 py-2 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 font-bold rounded-lg transition-all text-xs flex items-center gap-2 disabled:opacity-50"
            >
              <Upload size={14} />
              {uploading ? 'Uploading...' : 'Upload Folder (JSON)'}
            </button>
          </div>
          <div className="mt-6 flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider">
            <div className={`flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full ${!import.meta.env.VITE_DEEPSEEK_KEY ? 'opacity-50 grayscale' : ''}`}>
              <div className={`w-2 h-2 rounded-full ${import.meta.env.VITE_DEEPSEEK_KEY ? 'bg-blue-400 animate-pulse' : 'bg-gray-600'} shadow-[0_0_8px_rgba(96,165,250,0.5)]`} />
              <span className={import.meta.env.VITE_DEEPSEEK_KEY ? 'text-blue-400' : 'text-gray-500'}>
                {import.meta.env.VITE_DEEPSEEK_KEY ? 'DEEPSEEK V4 READY' : 'DEEPSEEK OFFLINE'}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
              <span className="text-emerald-400">WIKI: {buildPipeline.length} PAGES</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full">
              <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse shadow-[0_0_8px_rgba(192,132,252,0.5)]" />
              <span className="text-purple-400">MCP: {uploadedFolders.length + customAgents.length} AGENTS</span>
            </div>
          </div>

          <div className="w-full max-w-2xl mx-auto">
            <PullRequestList />
          </div>

          {/* Repo URL Ingestion */}
          <div className="mt-8 w-full max-w-md mx-auto">
            <div className="flex items-center gap-2 bg-[#0a0a0c] border border-[#2d2e32] rounded-xl p-1.5 focus-within:border-blue-500/50 transition-colors">
              <div className="pl-3 text-[#4a4b50]">
                <GitBranch size={14} />
              </div>
              <input
                type="text"
                value={repoUrl}
                onChange={e => setRepoUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleIngestRepo()}
                placeholder="Paste GitHub repo URL..."
                className="flex-1 bg-transparent text-white text-xs font-mono placeholder-[#4a4b50] outline-none py-2"
              />
              <button
                onClick={handleIngestRepo}
                disabled={ingesting || !repoUrl.trim()}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-black font-bold rounded-lg text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {ingesting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                INGEST
              </button>
            </div>
            <p className="text-[8px] font-mono text-[#4a4b50] mt-2 text-center uppercase tracking-wider">
              Paste any GitHub repo → ingested into wiki + queued for pipeline analysis
            </p>
          </div>

          {ingestedRepos.length > 0 && (
            <div className="mt-6 w-full max-w-md mx-auto">
              <h4 className="text-[10px] font-mono text-[#4a4b50] uppercase tracking-wider mb-2">Ingested Repositories</h4>
              <div className="space-y-1.5">
                {ingestedRepos.map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 bg-[#0a0a0c] border border-[#1a1b1e] rounded-lg">
                    <span className="text-xs font-mono text-emerald-400">{r.owner}/<strong className="text-white">{r.repo}</strong></span>
                    <div className="flex items-center gap-2">
                      <Check size={12} className="text-emerald-500" />
                      <span className="text-[9px] font-mono text-[#4a4b50]">QUEUED</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {trendingRepos.length > 0 && (
            <div className="mt-12 w-full max-w-4xl mx-auto">
              <SectionHeader title="Available Upgrades from Trending GitHub Repos" icon={Network} />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                {trendingRepos.slice(0, 6).map((repo) => (
                  <div key={repo.name} className="flex flex-col bg-[#0a0a0c] border border-[#1a1b1e] rounded-xl p-4 hover:border-blue-500/30 transition-all hover:-translate-y-1 shadow-lg shadow-black/50 group">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-bold text-white truncate pr-2 group-hover:text-blue-400 transition-colors" title={repo.name}>
                        {repo.name.split('/').pop()}
                      </h4>
                      <div className="flex items-center gap-1 text-[10px] text-[#8E9299] bg-[#151619] px-2 py-0.5 rounded-full border border-[#2d2e32]">
                        ★ {(repo.stars / 1000).toFixed(1)}k
                      </div>
                    </div>
                    <div className="text-[10px] font-mono text-[#4a4b50] mb-3 truncate">
                      {repo.name.split('/')[0]}
                    </div>
                    <p className="text-xs text-[#8E9299] flex-1 line-clamp-2 mb-4 leading-relaxed">
                      {repo.aiAnalysis || repo.description || 'No description provided.'}
                    </p>
                    <button
                      onClick={() => handleIngestRepo(repo.name)}
                      disabled={ingesting || ingestedRepos.some(r => `${r.owner}/${r.repo}` === repo.name)}
                      className="w-full py-2 bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white border border-blue-500/20 hover:border-blue-500 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                    >
                      {ingestedRepos.some(r => `${r.owner}/${r.repo}` === repo.name) ? (
                        <>
                          <Check size={14} />
                          Ingested
                        </>
                      ) : (
                        <>
                          <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                          Ingest Component
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFolderUpload}
            className="hidden"
          />
        </div>
      )}

      {uploadedFolders.length > 0 && !activeRun && (
        <div className="mt-8">
          <SectionHeader title="Uploaded Folders" icon={FolderUp} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {uploadedFolders.map((folder) => (
              <div
                key={folder.id}
                data-testid="pipeline-step"
                className="bg-[#151619] border border-[#2d2e32] p-4 rounded-xl hover:border-emerald-500/30 transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <FolderUp size={16} className="text-emerald-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{folder.name}</p>
                    <p className="text-[10px] font-mono text-[#4a4b50]">{folder.fileCount} files</p>
                  </div>
                </div>

                {assessing === folder.id && (
                  <div className="mb-3 flex items-center gap-2 text-[10px] font-mono text-purple-400">
                    <Loader2 size={10} className="animate-spin" />
                    ASSESSING...
                  </div>
                )}

                {folder.assessment && (
                  <div className="mb-3 space-y-2 p-2.5 bg-[#0a0a0c] border border-[#1a1b1e] rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-[#4a4b50]">TYPE</span>
                      <span className="text-[10px] font-mono text-emerald-400">{folder.assessment.type}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-[#4a4b50]">QUALITY</span>
                      <span className={`text-[10px] font-bold font-mono ${
                        folder.assessment.quality.overall === 'A' ? 'text-emerald-400' :
                        folder.assessment.quality.overall === 'B' ? 'text-blue-400' : 'text-amber-400'
                      }`}>{folder.assessment.quality.overall} (str {folder.assessment.quality.structureScore} ts {folder.assessment.quality.typeSafety})</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-[#4a4b50]">ASSIGNED</span>
                      <span className="text-[10px] font-mono text-purple-400">{folder.assessment.recommendedAssignment}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-[#4a4b50]">CONFIDENCE</span>
                      <span className="text-[10px] font-mono text-[#8E9299]">{Math.round(folder.assessment.confidence * 100)}%</span>
                    </div>
                    {folder.assessment.skills.length > 0 && (
                      <div className="pt-1.5 border-t border-[#1a1b1e]">
                        <span className="text-[9px] font-mono text-[#4a4b50]">SKILLS: </span>
                        {folder.assessment.skills.slice(0, 4).map((sk, i) => (
                          <span key={i} className="inline-block px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded text-[8px] font-mono text-purple-400 mr-1">{sk}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => triggerPipelineWithFolder(folder.id)}
                  className="w-full px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg transition-all text-xs flex items-center justify-center gap-2"
                >
                  <Activity size={12} />
                  Run Pipeline
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!activeRun && (
        <div className="mt-12">
          <SectionHeader title="Static Blueprint Analysis" icon={Search} />
          <PipelineVisualizer steps={buildPipeline} />
        </div>
      )}
    </div>
  );
};
