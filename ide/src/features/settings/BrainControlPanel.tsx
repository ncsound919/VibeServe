import { motion } from "motion/react";
import { Brain, RefreshCw, Power, PowerOff, Cpu, Wifi, WifiOff } from "lucide-react";
import type { BrainConfig, BrainStatus } from "../../types/settings";
import { PROVIDER_OPTIONS, LANE_DESCRIPTIONS } from "../../types/settings";

interface BrainControlPanelProps {
  config: BrainConfig;
  status: BrainStatus;
  onUpdateLane: (lane: string, cfg: { provider?: string; model?: string; enabled?: boolean }) => void;
  onRefresh: () => void;
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${
      ok ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/5" : "text-red-400 border-red-400/20 bg-red-400/5"
    }`}>
      {ok ? <Wifi size={10} /> : <WifiOff size={10} />}
      {label}
    </span>
  );
}

function LaneConfigCard({ lane, cfg, onUpdateLane }: {
  lane: string;
  cfg: { provider: string; model: string; enabled: boolean };
  onUpdateLane: (lane: string, cfg: { provider?: string; model?: string; enabled?: boolean }) => void;
}) {
  const description = LANE_DESCRIPTIONS[lane] ?? '';

  return (
    <motion.div
      layout
      className={`p-3 rounded-lg border transition-all ${
        cfg.enabled ? "border-[#2d2e32] bg-[#0a0a0c]/50" : "border-red-400/10 bg-red-400/5 opacity-60"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-mono text-white uppercase tracking-wider">{lane.replace('_', ' ')}</span>
        <button
          onClick={() => onUpdateLane(lane, { enabled: !cfg.enabled })}
          className={`p-1 rounded transition-colors ${
            cfg.enabled ? "text-emerald-400 hover:bg-emerald-400/10" : "text-red-400 hover:bg-red-400/10"
          }`}
        >
          {cfg.enabled ? <Power size={12} /> : <PowerOff size={12} />}
        </button>
      </div>
      {description && (
        <p className="text-[9px] text-[#4a4b50] mb-2 leading-relaxed">{description}</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] font-mono text-[#4a4b50] uppercase">Provider</label>
          <select
            value={cfg.provider}
            onChange={(e) => onUpdateLane(lane, { provider: e.target.value })}
            disabled={!cfg.enabled}
            className="w-full mt-0.5 text-[10px] font-mono bg-[#0a0a0c] border border-[#2d2e32] rounded px-2 py-1 text-white disabled:opacity-40"
          >
            {PROVIDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[9px] font-mono text-[#4a4b50] uppercase">Model</label>
          <input
            type="text"
            value={cfg.model}
            onChange={(e) => onUpdateLane(lane, { model: e.target.value })}
            disabled={!cfg.enabled}
            className="w-full mt-0.5 text-[10px] font-mono bg-[#0a0a0c] border border-[#2d2e32] rounded px-2 py-1 text-white disabled:opacity-40"
          />
        </div>
      </div>
    </motion.div>
  );
}

export function BrainControlPanel({ config, status, onUpdateLane, onRefresh }: BrainControlPanelProps) {
  return (
    <div className="bg-[#1a1b1e]/50 border border-[#2d2e32] p-5 rounded-xl">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Brain size={20} className="text-violet-400" />
          <h2 className="text-sm font-medium text-white">Deterministic Brain</h2>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge ok={status.pythonAvailable} label="Python" />
          <StatusBadge ok={status.running} label="API" />
          <span className="text-[10px] font-mono text-[#4a4b50]">Port {status.apiPort}</span>
          <button onClick={onRefresh} className="p-1 hover:bg-[#2d2e32] rounded transition-colors">
            <RefreshCw size={14} className="text-[#4a4b50] hover:text-white" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.entries(config.lanes).map(([lane, laneCfg]) => (
          <div key={lane}>
            <LaneConfigCard
              lane={lane}
              cfg={laneCfg}
              onUpdateLane={onUpdateLane}
            />
          </div>
        ))}
      </div>

      {status.brainDir && (
        <div className="mt-3 flex items-center gap-2 text-[10px] font-mono text-[#4a4b50]">
          <Cpu size={10} />
          <span>Brain directory: {status.brainDir}</span>
        </div>
      )}
    </div>
  );
}
