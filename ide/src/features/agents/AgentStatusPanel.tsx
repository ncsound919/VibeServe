import { useState } from 'react';
import { Bot, Activity, CheckCircle, XCircle, Clock, Pause, Play, Square, Timer } from 'lucide-react';
import { useAgentRuntime } from '../../core/agents/runtime/agentRuntime';

export function AgentStatusPanel() {
  const agentRuntime = useAgentRuntime();
  const [isMinimized, setIsMinimized] = useState(false);
  const [timeoutValue, setTimeoutValue] = useState(300);

  const activeSession = agentRuntime.getActiveSession();
  const getStatusIcon = (running: boolean, paused: boolean) => {
    if (paused) return <Pause className="w-3 h-3 text-amber-400" />;
    if (running) return <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />;
    return <Clock className="w-3 h-3 text-gray-400" />;
  };

  const handleTimeoutChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const seconds = parseInt(e.target.value) * 60;
    setTimeoutValue(parseInt(e.target.value));
    agentRuntime.setTimeout(seconds);
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] text-gray-300">
      <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium text-white">Agent Status</span>
          <span className={`px-1.5 py-0.5 text-xs rounded ${agentRuntime.isRunning ? 'bg-emerald-900 text-emerald-300' : 'bg-gray-700'}`}>
            {agentRuntime.isPaused ? 'Paused' : agentRuntime.isRunning ? 'Running' : 'Idle'}
          </span>
        </div>
        <button
          onClick={() => setIsMinimized(!isMinimized)}
          className="text-gray-400 hover:text-white"
        >
          {isMinimized ? '▼' : '▲'}
        </button>
      </div>

      {!isMinimized && (
        <div className="p-3 space-y-3">
          <div className="flex items-center gap-2">
            {agentRuntime.isRunning ? (
              <>
                {agentRuntime.isPaused ? (
                  <button
                    onClick={() => agentRuntime.resumeAgent()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900 text-emerald-300 rounded text-xs hover:bg-emerald-800"
                  >
                    <Play className="w-3 h-3" />
                    Resume
                  </button>
                ) : (
                  <button
                    onClick={() => agentRuntime.pauseAgent()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-900 text-amber-300 rounded text-xs hover:bg-amber-800"
                  >
                    <Pause className="w-3 h-3" />
                    Pause
                  </button>
                )}
                <button
                  onClick={() => agentRuntime.stopAgent()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900 text-red-300 rounded text-xs hover:bg-red-800"
                >
                  <Square className="w-3 h-3" />
                  Stop
                </button>
              </>
            ) : (
              <span className="text-xs text-gray-500">No agent running</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Timer className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-400">Timeout:</span>
            <select
              value={timeoutValue}
              onChange={handleTimeoutChange}
              className="bg-[#1e1e1e] border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
            >
              <option value={1}>1 min</option>
              <option value={2}>2 min</option>
              <option value={5}>5 min</option>
              <option value={10}>10 min</option>
              <option value={30}>30 min</option>
            </select>
          </div>

          {activeSession && (
            <div className="bg-[#252526] rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(agentRuntime.isRunning, agentRuntime.isPaused)}
                  <span className="text-sm text-white">Session</span>
                </div>
                <span className="text-xs text-gray-500 uppercase">{activeSession.state}</span>
              </div>
              <div className="text-xs text-gray-400">
                {activeSession.messages.length} messages, {activeSession.toolCalls.length} tool calls
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
