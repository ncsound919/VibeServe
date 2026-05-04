import { useState, useEffect } from 'react';
import { Cpu, HardDrive, Globe, Terminal, Search, RefreshCw, Copy, Eye, EyeOff, Bot, ToggleLeft, ToggleRight } from 'lucide-react';

interface SystemInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  cpus: number;
  totalMemory: string;
  homeDir: string;
}

interface EnvVar {
  key: string;
  value: string;
  visible: boolean;
}

export function SystemPanel() {
  const [activeTab, setActiveTab] = useState<'overview' | 'env' | 'processes'>('overview');
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [envFilter, setEnvFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [ollamaEnabled, setOllamaEnabled] = useState(false);

  const loadSystemInfo = () => {
    setLoading(true);
    
    setTimeout(() => {
      setSystemInfo({
        platform: 'win32',
        arch: 'x64',
        nodeVersion: process.versions?.node || '20.x',
        cpus: navigator.hardwareConcurrency || 4,
        totalMemory: `${Math.round((navigator as any).deviceMemory || 8)} GB`,
        homeDir: 'C:\\Users\\User',
      });

      const commonVars = [
        { key: 'PATH', value: 'C:\\Windows\\system32;C:\\Program Files\\nodejs', visible: false },
        { key: 'USERPROFILE', value: 'C:\\Users\\User', visible: true },
        { key: 'TEMP', value: 'C:\\Users\\User\\AppData\\Local\\Temp', visible: true },
        { key: 'NODE_ENV', value: 'development', visible: true },
        { key: 'DEBUG', value: 'false', visible: true },
        { key: 'API_URL', value: 'http://localhost:3000', visible: true },
        { key: 'DATABASE_URL', value: 'postgresql://user:***@localhost:5432/db', visible: false },
      ];
      
      setEnvVars(commonVars);
      setLoading(false);
    }, 300);
  };

  useEffect(() => {
    loadSystemInfo();
  }, []);

  const toggleVarVisibility = (index: number) => {
    setEnvVars(prev => prev.map((v, i) => 
      i === index ? { ...v, visible: !v.visible } : v
    ));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const filteredVars = envVars.filter(v => 
    v.key.toLowerCase().includes(envFilter.toLowerCase())
  );

  const overviewCards = [
    { icon: Cpu, label: 'Platform', value: systemInfo?.platform || '-', color: 'blue' },
    { icon: HardDrive, label: 'Architecture', value: systemInfo?.arch || '-', color: 'purple' },
    { icon: Globe, label: 'Node.js', value: systemInfo?.nodeVersion || '-', color: 'green' },
    { icon: Cpu, label: 'CPUs', value: systemInfo?.cpus?.toString() || '-', color: 'orange' },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="flex items-center gap-4 p-4 border-b border-slate-700">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 rounded text-sm ${activeTab === 'overview' ? 'bg-blue-600' : 'bg-slate-800'}`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('env')}
          className={`px-3 py-1.5 rounded text-sm ${activeTab === 'env' ? 'bg-blue-600' : 'bg-slate-800'}`}
        >
          Environment
        </button>
        <button
          onClick={() => setActiveTab('processes')}
          className={`px-3 py-1.5 rounded text-sm ${activeTab === 'processes' ? 'bg-blue-600' : 'bg-slate-800'}`}
        >
          Processes
        </button>

        <button
          onClick={loadSystemInfo}
          disabled={loading}
          className="ml-auto p-2 hover:bg-slate-800 rounded"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {overviewCards.map(card => (
                <div key={card.label} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 bg-${card.color}-500/20 rounded-lg`}>
                      <card.icon className={`w-5 h-5 text-${card.color}-400`} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{card.label}</p>
                      <p className="text-lg font-semibold">{card.value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h3 className="font-medium mb-3">System Paths</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                  <span className="text-sm text-slate-400">Home Directory</span>
                  <span className="text-sm font-mono">{systemInfo?.homeDir}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                  <span className="text-sm text-slate-400">Total Memory</span>
                  <span className="text-sm font-mono">{systemInfo?.totalMemory}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'env' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Filter variables..."
                value={envFilter}
                onChange={(e) => setEnvFilter(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              {filteredVars.map((var_, index) => (
                <div key={var_.key} className="flex items-center gap-2 p-3 bg-slate-800 rounded-lg border border-slate-700">
                  <span className="font-mono text-blue-400 min-w-[120px]">{var_.key}</span>
                  <span className="font-mono text-slate-400 flex-1 truncate">
                    {var_.visible ? var_.value : '••••••••'}
                  </span>
                  <button
                    onClick={() => toggleVarVisibility(index)}
                    className="p-1 hover:bg-slate-700 rounded"
                  >
                    {var_.visible ? <EyeOff className="w-4 h-4 text-slate-500" /> : <Eye className="w-4 h-4 text-slate-500" />}
                  </button>
                  <button
                    onClick={() => copyToClipboard(var_.value)}
                    className="p-1 hover:bg-slate-700 rounded"
                  >
                    <Copy className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'processes' && (
          <div className="text-center text-slate-500 py-8">
            <Terminal className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Process monitoring</p>
            <p className="text-xs mt-2">Running processes would appear here</p>
            <div className="mt-4 p-4 bg-slate-800 rounded-lg inline-block text-left">
              <p className="text-xs text-slate-400 mb-2">Sample Process</p>
              <p className="text-sm font-mono">node.exe — PID 1234 — 45MB</p>
              <p className="text-xs text-slate-500">Running for 2h 30m</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
