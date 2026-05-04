export interface AuditEvent {
  id: string;
  agentId: string;
  agentName: string;
  eventType: 'started' | 'completed' | 'failed' | 'error' | 'tool_execution' | 'approval_request';
  details: string;
  timestamp: number;
  duration?: number;
  cost?: number;
}

export interface AuditMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalCost: number;
  averageDuration: number;
}

export interface AuditStats {
  totalEvents: number;
  activeAgents: number;
  totalCost: number;
}

interface AuditStoreState {
  events: AuditEvent[];
  metrics: Record<string, AuditMetrics>;
}

const state: AuditStoreState = {
  events: [],
  metrics: {},
};

const addEvent = (event: Omit<AuditEvent, 'id'>) => {
  const newEvent: AuditEvent = {
    ...event,
    id: `${event.agentId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
  state.events.push(newEvent);

  // Keep only last 10000 events
  if (state.events.length > 10000) {
    state.events = state.events.slice(-10000);
  }

  // Update metrics
  if (!state.metrics[event.agentId]) {
    state.metrics[event.agentId] = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalCost: 0,
      averageDuration: 0,
    };
  }

  const metrics = state.metrics[event.agentId];
  metrics.totalExecutions += 1;

  if (event.eventType === 'completed') {
    metrics.successfulExecutions += 1;
  } else if (event.eventType === 'failed' || event.eventType === 'error') {
    metrics.failedExecutions += 1;
  }

  if (event.cost) {
    metrics.totalCost += event.cost;
  }

  if (event.duration) {
    metrics.averageDuration = (metrics.averageDuration * (metrics.totalExecutions - 1) + event.duration) / metrics.totalExecutions;
  }

  return newEvent;
};

const getEvents = (filter?: {
  agentId?: string;
  eventType?: AuditEvent['eventType'];
  limit?: number;
}) => {
  let filtered = state.events;

  if (filter?.agentId) {
    filtered = filtered.filter(e => e.agentId === filter.agentId);
  }
  if (filter?.eventType) {
    filtered = filtered.filter(e => e.eventType === filter.eventType);
  }
  if (filter?.limit) {
    filtered = filtered.slice(-filter.limit);
  }

  return filtered;
};

const getOverallStats = (): AuditStats => {
  const totalEvents = state.events.length;
  const activeAgents = Object.keys(state.metrics).length;
  const totalCost = Object.values(state.metrics).reduce((sum, m) => sum + m.totalCost, 0);

  return { totalEvents, activeAgents, totalCost };
};

export const useAuditStore = () => ({
  events: state.events,
  metrics: state.metrics,
  addEvent,
  getEvents,
  getOverallStats,
});