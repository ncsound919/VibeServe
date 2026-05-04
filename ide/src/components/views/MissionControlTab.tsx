import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  AlertTriangle, Cpu, MemoryStick, Network, Sliders, ShieldAlert,
  Zap, Info, ListTodo
} from 'lucide-react';
import { kernelService } from '../../services/kernelService';

interface Agent {
  id: string;
  name: string;
  type: string;
  status: 'idle' | 'running' | 'paused' | 'error' | 'completed';
  progress: number;
  logs: string[];
  startedAt: string | null;
  duration: number;
}

interface AgentPool {
  active: number;
  idle: number;
  max: number;
}

const mockAgents: Agent[] = [
  { id: '1', name: 'Code Reviewer', type: 'coding', status: 'running', progress: 65, logs: ['Analyzing PR #42...', 'Found 3 issues', 'Running security scan...'], startedAt: new Date().toISOString(), duration: 0 },
  { id: '2', name: 'Test Generator', type: 'testing', status: 'idle', progress: 0, logs: [], startedAt: null, duration: 0 },
  { id: '3', name: 'Docs Writer', type: 'documentation', status: 'completed', progress: 100, logs: ['Generated API docs', 'Updated README.md'], startedAt: new Date(Date.now() - 120000).toISOString(), duration: 120 },
];

export default function MissionControlTab() {
  const [agents, setAgents] = useState<Agent[]>(mockAgents);
  const [pool, setPool] = useState<AgentPool>({ active: 1, idle: 2, max: 5 });
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [isAllPaused, setIsAllPaused] = useState(false);
  const [autonomy, setAutonomy] = useState(50);
  const [temperature, setTemperature] = useState(0.2);
  const [kernelStatus, setKernelStatus] = useState(kernelService.getKernelStatus());

  useEffect(() => {
    const interval = setInterval(() => {
      setKernelStatus(kernelService.getKernelStatus());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handlePauseAll = () => {
    setIsAllPaused(!isAllPaused);
    setAgents(agents.map(a => a.status === 'running' ? { ...a, status: isAllPaused ? 'running' : 'paused' } : a));
  };

  const handleStopAgent = (id: string) => {
    setAgents(agents.map(a => a.id === id ? { ...a, status: 'idle', progress: 0 } : a));
    setPool({ ...pool, active: pool.active - 1, idle: pool.idle + 1 });
  };

  const handleResumeAgent = (id: string) => {
    setAgents(agents.map(a => a.id === id ? { ...a, status: 'running' } : a));
  };

  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'running': return 'text-emerald-400';
      case 'paused': return 'text-amber-400';
      case 'error': return 'text-red-400';
      case 'completed': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: Agent['status']) => {
    switch (status) {
      case 'running': return <Activity className="w-4 h-4" />;
      case 'paused': return <Pause className="w-4 h-4" />;
      case 'error': return <AlertTriangle className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Brain className="w-7 h-7 text-indigo-400" />
            Mission Control
          </h1>
          <p className="text-gray-400 mt-1">Agent orchestration & monitoring dashboard</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handlePauseAll}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors"
          >
            {isAllPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            {isAllPaused ? 'Resume All' : 'Pause All'}
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition-colors">
            <Bot className="w-4 h-4" />
            Spawn Agent
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900/50 border border-gray-800 rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Cpu className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Active Agents</p>
              <p className="text-2xl font-bold text-white">{pool.active}</p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-900/50 border border-gray-800 rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-500/20 rounded-lg">
              <MemoryStick className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Idle Agents</p>
              <p className="text-2xl font-bold text-white">{pool.idle}</p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-900/50 border border-gray-800 rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <Network className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Pool Capacity</p>
              <p className="text-2xl font-bold text-white">{pool.active}/{pool.max}</p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-900/50 border border-gray-800 rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Terminal className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Tasks</p>
              <p className="text-2xl font-bold text-white">12</p>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-white">Agent Status</h2>
          {agents.map((agent) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`bg-gray-900/50 border rounded-xl p-4 cursor-pointer transition-all ${
                selectedAgent === agent.id ? 'border-indigo-500/50' : 'border-gray-800 hover:border-gray-700'
              }`}
              onClick={() => setSelectedAgent(agent.id)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    agent.status === 'running' ? 'bg-emerald-500/20' :
                    agent.status === 'error' ? 'bg-red-500/20' :
                    agent.status === 'completed' ? 'bg-blue-500/20' :
                    'bg-gray-500/20'
                  }`}>
                    <Bot className={`w-5 h-5 ${getStatusColor(agent.status)}`} />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{agent.name}</h3>
                    <p className="text-sm text-gray-500">{agent.type}</p>
                  </div>
                </div>
                <div className={`flex items-center gap-2 ${getStatusColor(agent.status)}`}>
                  {getStatusIcon(agent.status)}
                  <span className="capitalize">{agent.status}</span>
                </div>
              </div>

              {agent.status === 'running' && (
                <div className="mb-3">
                  <div className="flex justify-between text-sm text-gray-400 mb-1">
                    <span>Progress</span>
                    <span>{agent.progress}%</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-indigo-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${agent.progress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                {agent.status === 'running' && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleStopAgent(agent.id); }}
                    className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <Square className="w-4 h-4" />
                  </button>
                )}
                {agent.status === 'paused' && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleResumeAgent(agent.id); }}
                    className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-emerald-400 transition-colors"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                )}
                <span className="text-xs text-gray-500">
                  {agent.startedAt && `Started ${new Date(agent.startedAt).toLocaleTimeString()}`}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

          </div>
        </div>

        <div className="space-y-6">
          {/* Agency & Psychology Sliders */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                Agency Controls
              </h2>
              <Info className="w-3 h-3 text-gray-500 cursor-help" />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase">
                  <span>Autonomy Level</span>
                  <span className="text-indigo-400">{autonomy}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={autonomy}
                  onChange={(e) => setAutonomy(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <div className="flex justify-between text-[8px] text-gray-600 uppercase font-mono">
                  <span>Consultant</span>
                  <span>Co-Pilot</span>
                  <span>Architect</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase">
                  <span>Safety Temp</span>
                  <span className="text-amber-400">{temperature}</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={temperature * 100}
                  onChange={(e) => setTemperature(Number(e.target.value) / 100)}
                  className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-[8px] text-gray-600 uppercase font-mono">
                  <span>Deterministic</span>
                  <span>Creative</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-800 flex items-center gap-3">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              <div className="text-[10px] text-gray-400 leading-tight">
                <span className="text-white font-bold block">Mechanical Trust Active</span>
                Grounded by .nexus_wiki context
              </div>
            </div>
          </div>

          {/* Kernel Status */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              OS Kernel Status
            </h2>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Active PIDs</span>
                <span className="text-xs font-mono text-emerald-400">{kernelStatus.activeProcesses.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Context RAM</span>
                <span className="text-xs font-mono text-indigo-400">{kernelStatus.ramUsage} slots</span>
              </div>
              
              <div className="space-y-2 max-h-32 overflow-y-auto pt-2">
                {kernelStatus.activeProcesses.map(p => (
                  <div key={p.pid} className="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] text-gray-300 font-mono">{p.pid}</span>
                    </div>
                    <span className="text-[9px] text-gray-500 uppercase">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <h2 className="text-lg font-semibold text-white">Agent Logs</h2>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 h-[300px] overflow-y-auto font-mono text-sm">
            {selectedAgent ? (
              agents.find(a => a.id === selectedAgent)?.logs.map((log, i) => (
                <div key={i} className="text-gray-400 py-1 border-b border-gray-800/50">
                  <span className="text-gray-600">[{new Date().toLocaleTimeString()}]</span> {log}
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-center py-8">
                Select an agent to view logs
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
