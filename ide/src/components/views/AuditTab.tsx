import { useState, useMemo } from 'react';
import { useAuditStore, type AuditEvent } from '../core/agents/monitoring/auditStore';
import { BarChart3, Activity, Clock, DollarSign, Zap, AlertCircle, CheckCircle } from 'lucide-react';

export function AuditTab() {
  const { events, metrics, getEvents, getOverallStats } = useAuditStore();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<string>('all');

  const overallStats = useMemo(() => getOverallStats(), [events]);
  const agentIds = useMemo(() => Object.keys(metrics), [metrics]);
  
  const filteredEvents = useMemo(() => {
    return getEvents({
      agentId: selectedAgentId || undefined,
      eventType: eventFilter !== 'all' ? eventFilter as any : undefined,
      limit: 100,
    });
  }, [selectedAgentId, eventFilter, events]);

  const getEventColor = (type: AuditEvent['eventType']) => {
    switch (type) {
      case 'completed': return 'text-emerald-400';
      case 'failed':
      case 'error': return 'text-red-400';
      case 'started': return 'text-blue-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          Audit & Monitoring
        </h1>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Total Events</p>
              <p className="text-2xl font-bold">{overallStats.totalEvents}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Zap className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Active Agents</p>
              <p className="text-2xl font-bold">{overallStats.activeAgents}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Total Cost</p>
              <p className="text-2xl font-bold">${overallStats.totalCost.toFixed(4)}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Clock className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Recent Events</p>
              <p className="text-2xl font-bold">{events.filter(e => Date.now() - e.timestamp < 3600000).length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <select
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
          value={selectedAgentId || ''}
          onChange={(e) => setSelectedAgentId(e.target.value || null)}
        >
          <option value="">All Agents</option>
          {agentIds.map(id => (
            <option key={id} value={id}>{metrics[id]?.totalExecutions ? `Agent ${id.slice(0, 8)}` : id}</option>
          ))}
        </select>

        <select
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
        >
          <option value="all">All Events</option>
          <option value="started">Started</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="tool_execution">Tool Execution</option>
          <option value="approval_request">Approval Request</option>
        </select>
      </div>

      <div className="flex-1 overflow-auto bg-slate-800 rounded-lg border border-slate-700">
        <div className="p-3 border-b border-slate-700 bg-slate-800/50">
          <h3 className="font-medium">Event Log</h3>
        </div>
        <div className="divide-y divide-slate-700/50">
          {filteredEvents.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No events to display
            </div>
          ) : (
            filteredEvents.map(event => (
              <div key={event.id} className="p-3 hover:bg-slate-800/30 flex items-start gap-3">
                <div className={`mt-0.5 ${getEventColor(event.eventType)}`}>
                  {event.eventType === 'completed' ? <CheckCircle className="w-4 h-4" /> :
                   event.eventType === 'failed' || event.eventType === 'error' ? <AlertCircle className="w-4 h-4" /> :
                   <Activity className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{event.agentName}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      event.eventType === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                      event.eventType === 'failed' ? 'bg-red-500/20 text-red-400' :
                      'bg-slate-600 text-slate-300'
                    }`}>
                      {event.eventType}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 truncate mt-1">{event.details}</p>
                  {event.duration && (
                    <div className="text-xs text-slate-500 mt-1">
                      Duration: {event.duration}ms
                      {event.cost && ` | Cost: $${event.cost.toFixed(4)}`}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
