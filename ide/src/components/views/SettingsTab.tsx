import { useEffect, useState } from "react";
import { Settings, Activity, Users, Save, Shield, Cpu } from "lucide-react";
import { BrainControlPanel } from "../features/settings/BrainControlPanel";
import { IntegrationsPanel } from "../features/settings/IntegrationsPanel";
import { ProjectRulesPanel } from "../features/settings/ProjectRulesPanel";
import { useSettingsStore } from "../stores/useSettingsStore";
import { ollamaService } from "../services/ollamaService";

function PrivacyModePanel() {
  const [privacyMode, setPrivacyMode] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('nexus_privacy_mode') === 'true';
    }
    return false;
  });
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('llama3.1');

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.privacyMode !== undefined) {
          setPrivacyMode(data.privacyMode === 'local');
        }
      });
  }, []);

  useEffect(() => {
    if (privacyMode) {
      ollamaService.listModels().then(setOllamaModels);
    }
  }, [privacyMode]);

  const toggle = async () => {
    const next = !privacyMode;
    try {
      const res = await fetch('/api/settings/privacy-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: next ? 'local' : 'cloud' })
      });
      if (res.ok) {
        setPrivacyMode(next);
      }
    } catch (e) {
      console.error('Failed to sync privacy mode', e);
    }
  };

  return (
    <div className="bg-[#1a1b1e]/50 border border-[#2d2e32] p-5 rounded-xl">
      <div className="flex items-center gap-3 mb-4">
        <Shield size={20} className="text-emerald-400" />
        <h2 className="text-sm font-medium text-white">AI Provider</h2>
      </div>

      <div className="p-4 rounded-lg border border-[#2d2e32] bg-[#0a0a0c]/50">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-white">Privacy Mode / Offline</span>
            <p className="text-[9px] text-[#4a4b50] mt-0.5">
              {privacyMode
                ? "All data stays on your machine. No API calls to external services."
                : "Cloud providers available. Enable for fully local AI."}
            </p>
          </div>
          <button
            onClick={toggle}
            className={`w-9 h-5 rounded-full transition-colors relative ${privacyMode ? "bg-emerald-400" : "bg-[#2d2e32]"}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${privacyMode ? "translate-x-[18px]" : "translate-x-0.5"}`} />
          </button>
        </div>

        {privacyMode && (
          <div className="mt-3 p-3 rounded-lg border border-emerald-400/20 bg-emerald-400/5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Cpu size={12} className="text-emerald-400" />
                <span className="text-[10px] font-mono text-emerald-400">Local AI Engine (Ollama)</span>
              </div>
              <span className="text-[8px] font-mono text-emerald-400/50 uppercase tracking-tighter">Connected</span>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-[9px] font-mono text-[#4a4b50] uppercase min-w-[60px]">Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="flex-1 text-[10px] font-mono bg-[#0a0a0c] border border-[#2d2e32] rounded px-2 py-1 text-white outline-none focus:border-emerald-500/50"
                >
                  {ollamaModels.length > 0 ? (
                    ollamaModels.map(m => <option key={m} value={m}>{m}</option>)
                  ) : (
                    <option value="llama3.1">llama3.1 (default)</option>
                  )}
                </select>
              </div>

              <div className="text-[9px] text-[#4a4b50] space-y-1">
                <p>Zero API keys required — all processing runs on your hardware</p>
                <p className="text-emerald-400/70 mt-1">Endpoint: {typeof process !== 'undefined' && (process.env.OLLAMA_HOST || 'http://localhost:11434')}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PipelineConfigPanel() {
  const { pipeline, updatePipelineConfig } = useSettingsStore();
  const [local, setLocal] = useState(pipeline);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLocal(pipeline);
  }, [pipeline]);

  const handleSave = async () => {
    await updatePipelineConfig(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const toggle = (key: keyof typeof local, value: boolean | string | number) => {
    setLocal({ ...local, [key]: value });
  };

  return (
    <div className="bg-[#1a1b1e]/50 border border-[#2d2e32] p-5 rounded-xl">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Activity size={20} className="text-amber-400" />
          <h2 className="text-sm font-medium text-white">Pipeline Configuration</h2>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 text-[10px] font-mono px-3 py-1.5 rounded bg-[#2d2e32] hover:bg-[#3d3e42] text-white transition-colors"
        >
          <Save size={12} />
          {saved ? "Saved" : "Save"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="p-3 rounded-lg border border-[#2d2e32] bg-[#0a0a0c]/50">
          <label className="text-[9px] font-mono text-[#4a4b50] uppercase">Build Timeout (s)</label>
          <input
            type="number"
            value={local.buildTimeout}
            onChange={(e) => toggle("buildTimeout", Number(e.target.value))}
            className="w-full mt-0.5 text-[10px] font-mono bg-[#0a0a0c] border border-[#2d2e32] rounded px-2 py-1 text-white"
          />
        </div>
        <div className="p-3 rounded-lg border border-[#2d2e32] bg-[#0a0a0c]/50">
          <label className="text-[9px] font-mono text-[#4a4b50] uppercase">Max Parallel Phases</label>
          <input
            type="number"
            value={local.maxParallelPhases}
            onChange={(e) => toggle("maxParallelPhases", Number(e.target.value))}
            className="w-full mt-0.5 text-[10px] font-mono bg-[#0a0a0c] border border-[#2d2e32] rounded px-2 py-1 text-white"
          />
        </div>
        <div className="p-3 rounded-lg border border-[#2d2e32] bg-[#0a0a0c]/50 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono text-white">Auto-Retry on Failure</span>
            <p className="text-[9px] text-[#4a4b50]">Retry failed phases</p>
          </div>
          <button
            onClick={() => toggle("autoRetry", !local.autoRetry)}
            className={`w-9 h-5 rounded-full transition-colors relative ${local.autoRetry ? "bg-emerald-400" : "bg-[#2d2e32]"}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${local.autoRetry ? "translate-x-[18px]" : "translate-x-0.5"}`} />
          </button>
        </div>
        <div className="p-3 rounded-lg border border-[#2d2e32] bg-[#0a0a0c]/50">
          <label className="text-[9px] font-mono text-[#4a4b50] uppercase">Security Scan Depth</label>
          <select
            value={local.securityDepth}
            onChange={(e) => toggle("securityDepth", e.target.value)}
            className="w-full mt-0.5 text-[10px] font-mono bg-[#0a0a0c] border border-[#2d2e32] rounded px-2 py-1 text-white"
          >
            <option value="basic">Basic</option>
            <option value="full">Full</option>
          </select>
        </div>
        <div className="p-3 rounded-lg border border-[#2d2e32] bg-[#0a0a0c]/50 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono text-white">Wiki Auto-Compile</span>
            <p className="text-[9px] text-[#4a4b50]">Auto-compile wiki</p>
          </div>
          <button
            onClick={() => toggle("wikiAutoCompile", !local.wikiAutoCompile)}
            className={`w-9 h-5 rounded-full transition-colors relative ${local.wikiAutoCompile ? "bg-emerald-400" : "bg-[#2d2e32]"}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${local.wikiAutoCompile ? "translate-x-[18px]" : "translate-x-0.5"}`} />
          </button>
        </div>
        <div className="p-3 rounded-lg border border-[#2d2e32] bg-[#0a0a0c]/50 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono text-white">Graphify Auto-Build</span>
            <p className="text-[9px] text-[#4a4b50]">Auto-build graphs</p>
          </div>
          <button
            onClick={() => toggle("graphifyAutoBuild", !local.graphifyAutoBuild)}
            className={`w-9 h-5 rounded-full transition-colors relative ${local.graphifyAutoBuild ? "bg-emerald-400" : "bg-[#2d2e32]"}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${local.graphifyAutoBuild ? "translate-x-[18px]" : "translate-x-0.5"}`} />
          </button>
        </div>
        <div className="p-3 rounded-lg border border-[#2d2e32] bg-[#0a0a0c]/50 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono text-white">TOON Auto-Compress</span>
            <p className="text-[9px] text-[#4a4b50]">Auto-compress JSON</p>
          </div>
          <button
            onClick={() => toggle("toonAutoCompress", !local.toonAutoCompress)}
            className={`w-9 h-5 rounded-full transition-colors relative ${local.toonAutoCompress ? "bg-emerald-400" : "bg-[#2d2e32]"}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${local.toonAutoCompress ? "translate-x-[18px]" : "translate-x-0.5"}`} />
          </button>
        </div>
      </div>
    </div>
  );
}

function AgentRegistryPanel() {
  const { agents } = useSettingsStore();

  const handleReassess = (id: string) => {
    // TODO: wire to re-assessment endpoint
  };

  const handleRemove = (id: string) => {
    // TODO: wire to removal endpoint
  };

  return (
    <div className="bg-[#1a1b1e]/50 border border-[#2d2e32] p-5 rounded-xl">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Users size={20} className="text-rose-400" />
          <h2 className="text-sm font-medium text-white">Agent Registry</h2>
        </div>
        {agents.length > 0 && (
          <span className="text-[10px] font-mono text-[#4a4b50]">{agents.length} agent{agents.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {agents.length === 0 ? (
        <p className="text-[10px] text-[#4a4b50] italic">No agents uploaded or assessed yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="p-3 rounded-lg border border-[#2d2e32] bg-[#0a0a0c]/50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-mono text-white">{agent.name}</span>
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                  agent.qualityGrade === 'A' ? "text-emerald-400 bg-emerald-400/10" :
                  agent.qualityGrade === 'B' ? "text-amber-400 bg-amber-400/10" :
                  "text-[#4a4b50] bg-[#2d2e32]/50"
                }`}>{agent.qualityGrade}</span>
              </div>
              <div className="text-[9px] text-[#4a4b50] space-y-0.5">
                <p>Type: <span className="text-white/70">{agent.type}</span></p>
                <p>Phase: <span className="text-white/70">{agent.assignedPhase}</span></p>
                <p>Skills: <span className="text-white/70">{agent.skills.join(', ') || '—'}</span></p>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handleReassess(agent.id)}
                  className="text-[9px] font-mono px-2 py-0.5 rounded bg-violet-400/10 text-violet-400 hover:bg-violet-400/20 transition-colors"
                >
                  Re-assess
                </button>
                <button
                  onClick={() => handleRemove(agent.id)}
                  className="text-[9px] font-mono px-2 py-0.5 rounded bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SettingsTab() {
  const { brain, brainStatus, integrations, loading, refreshAll, updateBrainConfig } = useSettingsStore();

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateLane = async (lane: string, cfg: { provider?: string; model?: string; enabled?: boolean }) => {
    const current = brain.lanes[lane];
    if (!current) return;
    const updatedLanes = {
      ...brain.lanes,
      [lane]: { ...current, ...cfg },
    };
    await updateBrainConfig(updatedLanes);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Settings size={22} className="text-emerald-400" />
        <h1 className="text-lg font-semibold text-white">System Settings</h1>
        {loading && (
          <span className="text-[10px] font-mono text-[#4a4b50] animate-pulse">Refreshing...</span>
        )}
      </div>

      <BrainControlPanel
        config={brain}
        status={brainStatus}
        onUpdateLane={handleUpdateLane}
        onRefresh={refreshAll}
      />

      <PipelineConfigPanel />

      <ProjectRulesPanel />

      <PrivacyModePanel />

      <IntegrationsPanel
        integrations={integrations}
        onRefresh={refreshAll}
      />

      <AgentRegistryPanel />
    </div>
  );
}
