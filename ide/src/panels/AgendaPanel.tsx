import { useState, useEffect, useCallback } from 'react';
import { useIDEStore } from '../stores/useIDEStore';

interface Goal {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  timeline?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface Progress {
  total_entries: number;
  completed: number;
  in_progress: number;
  pending: number;
  active_goals: number;
  completed_goals: number;
  by_goal: Record<string, { title: string; status: string; priority: number; total: number; completed: number; in_progress: number; pending: number }>;
}

interface AgendaData {
  goals: Goal[];
  constraints: string[];
  progress: Progress;
  recent_entries: any[];
}

const STATUS_COLORS: Record<string, string> = {
  planned: '#6b7280',
  active: '#3b82f6',
  completed: '#22c55e',
  blocked: '#ef4444',
};

const PRIORITY_LABELS: Record<number, string> = {
  1: 'P1 — Critical',
  2: 'P2 — High',
  3: 'P3 — Medium',
  4: 'P4 — Low',
  5: 'P5 — Backlog',
};

export function AgendaPanel() {
  const [agenda, setAgenda] = useState<AgendaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoal, setNewGoal] = useState({ title: '', description: '', priority: 3, timeline: '' });
  const [showAddConstraint, setShowAddConstraint] = useState(false);
  const [newConstraint, setNewConstraint] = useState('');
  const { autonomyMode, setAutonomyMode } = useIDEStore();

  const fetchAgenda = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apiBase = window.location.port === '3000' ? 'http://localhost:3002' : '';
      const res = await fetch(`${apiBase}/api/pipeline/agenda_status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAgenda(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAgenda(); }, [fetchAgenda]);

  const addGoal = useCallback(async () => {
    if (!newGoal.title.trim()) return;
    try {
      const apiBase = window.location.port === '3000' ? 'http://localhost:3002' : '';
      const res = await fetch(`${apiBase}/api/pipeline/mcp_call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'agenda_add_goal',
          args: {
            title: newGoal.title,
            description: newGoal.description,
            priority: newGoal.priority,
            timeline: newGoal.timeline || '',
          },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setShowAddGoal(false);
      setNewGoal({ title: '', description: '', priority: 3, timeline: '' });
      await fetchAgenda();
    } catch (err: any) {
      setError(err.message);
    }
  }, [newGoal, fetchAgenda]);

  const activateGoal = useCallback(async (goalId: string) => {
    try {
      const apiBase = window.location.port === '3000' ? 'http://localhost:3002' : '';
      await fetch(`${apiBase}/api/pipeline/mcp_call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'agenda_activate_goal', args: { goal_id: goalId } }),
      });
      await fetchAgenda();
    } catch (err: any) {
      setError(err.message);
    }
  }, [fetchAgenda]);

  const completeGoal = useCallback(async (goalId: string) => {
    try {
      const apiBase = window.location.port === '3000' ? 'http://localhost:3002' : '';
      await fetch(`${apiBase}/api/pipeline/mcp_call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'agenda_complete_goal', args: { goal_id: goalId } }),
      });
      await fetchAgenda();
    } catch (err: any) {
      setError(err.message);
    }
  }, [fetchAgenda]);

  const completed = agenda?.progress.completed ?? 0;
  const total = agenda?.progress.total_entries ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary, #1e1e2e)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border, #313244)' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted, #6c7086)' }}>
          Agenda
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => setAutonomyMode(autonomyMode === 'pipeline' ? 'copilot' : 'pipeline')}
            className="px-2 py-0.5 rounded text-xs"
            style={{
              backgroundColor: autonomyMode === 'pipeline' ? 'var(--accent, #89b4fa)' : 'var(--bg-tertiary, #313244)',
              color: autonomyMode === 'pipeline' ? 'var(--bg-primary, #1e1e2e)' : 'var(--text-muted, #6c7086)',
            }}
          >
            {autonomyMode === 'pipeline' ? 'Background: ON' : 'Background: OFF'}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mx-3 mt-3 mb-1">
        <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-muted, #6c7086)' }}>
          <span>Progress</span>
          <span>{completed}/{total} ({pct}%)</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary, #313244)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: 'var(--accent, #89b4fa)' }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {loading && (
          <div className="text-xs" style={{ color: 'var(--text-muted, #6c7086)' }}>Loading agenda...</div>
        )}
        {error && (
          <div className="text-xs mb-2 p-2 rounded" style={{ color: 'var(--error, #f38ba8)', backgroundColor: 'var(--bg-tertiary, #313244)' }}>
            {error}
            <button onClick={fetchAgenda} className="ml-2 underline">Retry</button>
          </div>
        )}

        {/* Goals */}
        {agenda?.goals.length === 0 ? (
          <div className="text-xs py-4 text-center" style={{ color: 'var(--text-muted, #6c7086)' }}>
            No goals defined yet.
            <br />
            <span className="mt-1 block">Set your first goal below to get agents working.</span>
          </div>
        ) : (
          agenda?.goals.map((goal) => (
            <div
              key={goal.id}
              className="mb-2 p-2 rounded cursor-pointer hover:brightness-110 transition-colors"
              style={{ backgroundColor: 'var(--bg-tertiary, #313244)', borderLeft: `3px solid ${STATUS_COLORS[goal.status] || '#6b7280'}` }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary, #cdd6f4)' }}>
                  {goal.title}
                </span>
                <span className="text-xxs px-1.5 py-0.5 rounded" style={{ backgroundColor: STATUS_COLORS[goal.status] + '22', color: STATUS_COLORS[goal.status] }}>
                  {goal.status}
                </span>
              </div>
              {goal.description && (
                <div className="text-xxs mt-1" style={{ color: 'var(--text-muted, #6c7086)' }}>
                  {goal.description}
                </div>
              )}
              <div className="flex items-center gap-1 mt-1.5">
                <span className="text-xxs" style={{ color: 'var(--text-muted, #6c7086)' }}>
                  {PRIORITY_LABELS[goal.priority] || `P${goal.priority}`}
                </span>
                {goal.timeline && (
                  <span className="text-xxs px-1 rounded" style={{ color: 'var(--text-muted, #6c7086)', backgroundColor: 'var(--bg-primary, #1e1e2e)' }}>
                    {goal.timeline}
                  </span>
                )}
              </div>
              {/* Progress per goal */}
              {agenda.progress.by_goal[goal.id] && (
                <div className="mt-1.5">
                  <div className="flex gap-1">
                    <span className="text-xxs" style={{ color: 'var(--accent, #89b4fa)' }}>
                      {agenda.progress.by_goal[goal.id].completed} done
                    </span>
                    {agenda.progress.by_goal[goal.id].in_progress > 0 && (
                      <span className="text-xxs" style={{ color: '#f9e2af' }}>
                        {agenda.progress.by_goal[goal.id].in_progress} in progress
                      </span>
                    )}
                    <span className="text-xxs" style={{ color: 'var(--text-muted, #6c7086)' }}>
                      {agenda.progress.by_goal[goal.id].pending} pending
                    </span>
                  </div>
                </div>
              )}
              {/* Actions */}
              <div className="flex gap-1 mt-1.5">
                {goal.status === 'planned' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); activateGoal(goal.id); }}
                    className="text-xxs px-1.5 py-0.5 rounded hover:brightness-125"
                    style={{ backgroundColor: 'var(--accent, #89b4fa)', color: 'var(--bg-primary, #1e1e2e)' }}
                  >
                    Start
                  </button>
                )}
                {goal.status === 'active' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); completeGoal(goal.id); }}
                    className="text-xxs px-1.5 py-0.5 rounded hover:brightness-125"
                    style={{ backgroundColor: 'var(--success, #a6e3a1)', color: 'var(--bg-primary, #1e1e2e)' }}
                  >
                    Complete
                  </button>
                )}
              </div>
            </div>
          ))
        )}

        {/* Constraints */}
        {agenda?.constraints && agenda.constraints.length > 0 && (
          <div className="mt-3">
            <div className="text-xxs font-semibold mb-1" style={{ color: 'var(--text-muted, #6c7086)' }}>
              Constraints
            </div>
            {agenda.constraints.map((c, i) => (
              <div key={i} className="text-xxs pl-2 border-l" style={{ color: 'var(--text-muted, #6c7086)', borderColor: 'var(--warning, #f9e2af)' }}>
                {c}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Goal Button */}
      <div className="border-t px-3 py-2" style={{ borderColor: 'var(--border, #313244)' }}>
        {showAddGoal ? (
          <div className="space-y-1.5">
            <input
              value={newGoal.title}
              onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
              placeholder="Goal title (e.g., 'Ship user auth')"
              className="w-full text-xs px-2 py-1 rounded border focus:outline-none"
              style={{ backgroundColor: 'var(--bg-primary, #1e1e2e)', color: 'var(--text-primary, #cdd6f4)', borderColor: 'var(--border, #313244)' }}
              onKeyDown={(e) => e.key === 'Enter' && addGoal()}
            />
            <input
              value={newGoal.description}
              onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
              placeholder="Description (optional)"
              className="w-full text-xs px-2 py-1 rounded border focus:outline-none"
              style={{ backgroundColor: 'var(--bg-primary, #1e1e2e)', color: 'var(--text-primary, #cdd6f4)', borderColor: 'var(--border, #313244)' }}
            />
            <div className="flex gap-1">
              <select
                value={newGoal.priority}
                onChange={(e) => setNewGoal({ ...newGoal, priority: Number(e.target.value) })}
                className="text-xs px-2 py-1 rounded border"
                style={{ backgroundColor: 'var(--bg-primary, #1e1e2e)', color: 'var(--text-primary, #cdd6f4)', borderColor: 'var(--border, #313244)' }}
              >
                {[1, 2, 3, 4, 5].map(p => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
              <input
                value={newGoal.timeline}
                onChange={(e) => setNewGoal({ ...newGoal, timeline: e.target.value })}
                placeholder="Timeline (e.g., Q2)"
                className="flex-1 text-xs px-2 py-1 rounded border focus:outline-none"
                style={{ backgroundColor: 'var(--bg-primary, #1e1e2e)', color: 'var(--text-primary, #cdd6f4)', borderColor: 'var(--border, #313244)' }}
              />
            </div>
            <div className="flex gap-1">
              <button
                onClick={addGoal}
                className="flex-1 text-xs px-2 py-1 rounded"
                style={{ backgroundColor: 'var(--accent, #89b4fa)', color: 'var(--bg-primary, #1e1e2e)' }}
              >
                Add Goal
              </button>
              <button
                onClick={() => setShowAddGoal(false)}
                className="text-xs px-2 py-1 rounded"
                style={{ backgroundColor: 'var(--bg-tertiary, #313244)', color: 'var(--text-muted, #6c7086)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddGoal(true)}
            className="w-full text-xs py-1.5 rounded hover:brightness-110"
            style={{ backgroundColor: 'var(--bg-tertiary, #313244)', color: 'var(--text-muted, #6c7086)' }}
          >
            + Add Goal
          </button>
        )}
      </div>
    </div>
  );
}
