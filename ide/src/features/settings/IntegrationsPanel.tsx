import { motion } from "motion/react";
import { Server, Wifi, WifiOff, RefreshCw } from "lucide-react";
import type { IntegrationServiceItem } from "../../types/settings";

interface IntegrationsPanelProps {
  integrations: IntegrationServiceItem[];
  onRefresh: () => void;
}

interface IntegrationCardProps {
  item: IntegrationServiceItem;
}

function IntegrationCard({ item }: IntegrationCardProps) {
  return (
    <div className={`p-3 rounded-lg border transition-all ${
      item.configured
        ? item.connected
          ? "border-emerald-400/20 bg-emerald-400/5"
          : "border-amber-400/20 bg-amber-400/5"
        : "border-[#2d2e32] bg-[#0a0a0c]/50 opacity-60"
    }`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {item.configured && item.connected ? (
            <Wifi size={12} className="text-emerald-400" />
          ) : (
            <WifiOff size={12} className={item.configured ? "text-amber-400" : "text-[#4a4b50]"} />
          )}
          <span className="text-[11px] font-mono text-white uppercase">{item.name}</span>
        </div>
        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
          item.configured
            ? item.connected
              ? "text-emerald-400 bg-emerald-400/10"
              : "text-amber-400 bg-amber-400/10"
            : "text-[#4a4b50] bg-[#2d2e32]/50"
        }`}>
          {item.configured ? (item.connected ? "Online" : "Offline") : "Not configured"}
        </span>
      </div>
      <p className="text-[10px] text-[#4a4b50]">{item.description}</p>
    </div>
  );
}

export function IntegrationsPanel({ integrations, onRefresh }: IntegrationsPanelProps) {
  const online = integrations.filter((i) => i.connected).length;
  const configured = integrations.filter((i) => i.configured).length;

  return (
    <div className="bg-[#1a1b1e]/50 border border-[#2d2e32] p-5 rounded-xl">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Server size={20} className="text-cyan-400" />
          <h2 className="text-sm font-medium text-white">Integration Services</h2>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-mono text-emerald-400">{online}/{configured} online</span>
          <button onClick={onRefresh} className="p-1 hover:bg-[#2d2e32] rounded transition-colors">
            <RefreshCw size={14} className="text-[#4a4b50] hover:text-white" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {integrations.map((item) => (
          <div key={item.name}><IntegrationCard item={item} /></div>
        ))}
      </div>
    </div>
  );
}
