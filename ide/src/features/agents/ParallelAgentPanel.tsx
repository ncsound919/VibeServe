import { useState, useEffect } from 'react';
import { Play, Pause, Square, Plus, Check, X, Clock, Users, GitBranch, ArrowRight, Layers } from 'lucide-react';
import { useParallelOrchestrator, type ParallelWorkflow, type AgentTask, type ExecutionMode } from '../../services/parallelAgentOrchestrator';

const WORKFLOW_TEMPLATES = [
  { name: 'Multi-Agent Research', mode: 'fan-out' as ExecutionMode, description: 'Parallel research across web, code, and docs' },
  { name: 'Build Pipeline', mode: 'sequential' as ExecutionMode, description: 'Sequential build: setup → code → test → deploy' },
  { name: 'Code Review', mode: 'fan-in' as ExecutionMode, description: 'Parallel review + aggregation' },
  { name: 'Parallel Analysis', mode: 'parallel' as ExecutionMode, description: 'Independent parallel tasks with dependencies' },
];

export function ParallelAgentPanel() {
  const orchestrator = useParallelOrchestrator();
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowMode, setNewWorkflowMode] = useState<ExecutionMode>('parallel');

  useEffect(() => {
    const interval = setInterval(() => {
      if (orchestrator.activeWorkflowId) {
        const workflow = orchestrator.getWorkflow(orchestrator.activeWorkflowId);
        if (workflow?.status === 'completed' || workflow?.status === 'failed') {
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [orchestrator.activeWorkflowId]);

  const workflows = orchestrator.listWorkflows();
  const activeWorkflow = selectedWorkflow ? orchestrator.getWorkflow(selectedWorkflow) : null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-emerald-400 bg-emerald-900/30';
      case 'completed': return 'text-blue-400 bg-blue-900/30';
      case 'failed': return 'text-red-400 bg-red-900/30';
      case 'paused': return 'text-yellow-400 bg-yellow-900/30';
      case 'pending': return 'text-gray-400 bg-gray-800/50';
      case 'waiting': return 'text-amber-400 bg-amber-900/30';
      default: return 'text-gray-500 bg-gray-800/50';
    }
  };

  const getTaskStatusIcon = (task: AgentTask) => {
    switch (task.status) {
      case 'running': return <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />;
      case 'completed': return <Check className="w-3 h-3 text-emerald-400" />;
      case 'failed': return <X className="w-3 h-3 text-red-400" />;
      case 'waiting': return <Clock className="w-3 h-3 text-amber-400" />;
      default: return <div className="w-2 h-2 bg-gray-500 rounded-full" />;
    }
  };

  const handleCreateWorkflow = () => {
    if (!newWorkflowName.trim()) return;
    const id = orchestrator.createWorkflow(newWorkflowName, newWorkflowMode);
    setShowCreateModal(false);
    setNewWorkflowName('');
    setSelectedWorkflow(id);
  };

  const handleTemplateSelect = (template: typeof WORKFLOW_TEMPLATES[0]) => {
    const id = orchestrator.createWorkflow(template.name, template.mode);
    setSelectedWorkflow(id);
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] text-gray-300">
      <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-white">Parallel Agents</span>
          <span className="px-1.5 py-0.5 bg-cyan-900/50 text-cyan-300 text-xs rounded">
            {workflows.filter(w => w.status === 'running').length} active
          </span>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-cyan-900 text-cyan-300 rounded hover:bg-cyan-800"
        >
          <Plus className="w-3 h-3" />
          New
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r border-gray-800 p-3 overflow-y-auto">
          <div className="mb-4">
            <h4 className="text-xs font-medium text-gray-400 uppercase mb-2">Templates</h4>
            <div className="space-y-1">
              {WORKFLOW_TEMPLATES.map((template, i) => (
                <button
                  key={i}
                  onClick={() => handleTemplateSelect(template)}
                  className="w-full text-left px-3 py-2 rounded hover:bg-[#252526] transition-colors"
                >
                  <div className="text-sm text-white">{template.name}</div>
                  <div className="text-xs text-gray-500">{template.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-medium text-gray-400 uppercase mb-2">Workflows</h4>
            <div className="space-y-1">
              {workflows.length === 0 ? (
                <div className="text-xs text-gray-500 px-3 py-2">No workflows yet</div>
              ) : (
                workflows.map(wf => (
                  <button
                    key={wf.id}
                    onClick={() => setSelectedWorkflow(wf.id)}
                    className={`w-full text-left px-3 py-2 rounded transition-colors ${
                      selectedWorkflow === wf.id ? 'bg-[#252526]' : 'hover:bg-[#252526]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white">{wf.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${getStatusColor(wf.status)}`}>
                        {wf.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                      <Layers className="w-3 h-3" />
                      {wf.tasks.length} tasks • {wf.mode}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 p-4 overflow-y-auto">
          {activeWorkflow ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-white">{activeWorkflow.name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-sm px-2 py-0.5 rounded ${getStatusColor(activeWorkflow.status)}`}>
                      {activeWorkflow.status}
                    </span>
                    <span className="text-sm text-gray-500">{activeWorkflow.mode}</span>
                    <span className="text-sm text-gray-500">{activeWorkflow.tasks.length} tasks</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {activeWorkflow.status === 'pending' && (
                    <button
                      onClick={() => orchestrator.executeWorkflow(activeWorkflow.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-900 text-emerald-300 rounded text-sm hover:bg-emerald-800"
                    >
                      <Play className="w-4 h-4" />
                      Execute
                    </button>
                  )}
                  {activeWorkflow.status === 'running' && (
                    <>
                      <button
                        onClick={() => orchestrator.pauseWorkflow(activeWorkflow.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-yellow-900 text-yellow-300 rounded text-sm hover:bg-yellow-800"
                      >
                        <Pause className="w-4 h-4" />
                        Pause
                      </button>
                      <button
                        onClick={() => orchestrator.cancelWorkflow(activeWorkflow.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-900 text-red-300 rounded text-sm hover:bg-red-800"
                      >
                        <Square className="w-4 h-4" />
                        Cancel
                      </button>
                    </>
                  )}
                  {activeWorkflow.status === 'paused' && (
                    <button
                      onClick={() => orchestrator.resumeWorkflow(activeWorkflow.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-900 text-emerald-300 rounded text-sm hover:bg-emerald-800"
                    >
                      <Play className="w-4 h-4" />
                      Resume
                    </button>
                  )}
                </div>
              </div>

              {activeWorkflow.checkpoints.length > 0 && (
                <div className="bg-[#252526] rounded-lg p-3">
                  <h4 className="text-sm font-medium text-white mb-2">Checkpoints</h4>
                  <div className="space-y-2">
                    {activeWorkflow.checkpoints.map((cp, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-[#1e1e1e] rounded">
                        <div className="flex items-center gap-2">
                          {cp.approved === true ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : cp.approved === false ? (
                            <X className="w-4 h-4 text-red-400" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-400" />
                          )}
                          <span className="text-sm text-white">{cp.name}</span>
                        </div>
                        {cp.requiresApproval && cp.approved === undefined && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => orchestrator.approveCheckpoint(activeWorkflow.id, cp.name)}
                              className="px-2 py-1 text-xs bg-emerald-900 text-emerald-300 rounded hover:bg-emerald-800"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => orchestrator.rejectCheckpoint(activeWorkflow.id, cp.name)}
                              className="px-2 py-1 text-xs bg-red-900 text-red-300 rounded hover:bg-red-800"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-[#252526] rounded-lg p-3">
                <h4 className="text-sm font-medium text-white mb-3">Tasks</h4>
                <div className="space-y-2">
                  {activeWorkflow.tasks.map((task, i) => (
                    <div key={task.id} className="flex items-center gap-3 p-3 bg-[#1e1e1e] rounded">
                      <div className="w-6 h-6 rounded-full bg-cyan-900/50 flex items-center justify-center text-xs text-cyan-300">
                        {i + 1}
                      </div>
                      {getTaskStatusIcon(task)}

                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white">{task.agentName}</div>
                        <div className="text-xs text-gray-500 truncate">{task.input}</div>
                      </div>

                      {task.dependencies.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <GitBranch className="w-3 h-3" />
                          {task.dependencies.length} deps
                        </div>
                      )}

                      {task.result && (
                        <span className="text-xs text-emerald-400">Done</span>
                      )}
                      {task.error && (
                        <span className="text-xs text-red-400">{task.error}</span>
                      )}
                    </div>
                  ))}

                  {activeWorkflow.tasks.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No tasks in this workflow
                    </div>
                  )}
                </div>
              </div>

              {Object.keys(activeWorkflow.sharedMemory).length > 0 && (
                <div className="bg-[#252526] rounded-lg p-3">
                  <h4 className="text-sm font-medium text-white mb-2">Shared Memory</h4>
                  <pre className="text-xs text-gray-400 overflow-x-auto">
                    {JSON.stringify(activeWorkflow.sharedMemory, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a workflow to view details</p>
                <p className="text-xs text-gray-600 mt-1">Or use a template to create one</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#1e1e1e] rounded-lg w-96 p-4">
            <h3 className="text-lg font-medium text-white mb-4">Create Workflow</h3>

            <div className="mb-4">
              <label className="text-sm text-gray-400">Name</label>
              <input
                type="text"
                value={newWorkflowName}
                onChange={(e) => setNewWorkflowName(e.target.value)}
                placeholder="My Workflow"
                className="w-full mt-1 bg-[#252526] border border-gray-700 rounded px-3 py-2 text-white"
              />
            </div>

            <div className="mb-4">
              <label className="text-sm text-gray-400">Execution Mode</label>
              <select
                value={newWorkflowMode}
                onChange={(e) => setNewWorkflowMode(e.target.value as ExecutionMode)}
                className="w-full mt-1 bg-[#252526] border border-gray-700 rounded px-3 py-2 text-white"
              >
                <option value="parallel">Parallel (concurrent tasks)</option>
                <option value="sequential">Sequential (one after another)</option>
                <option value="fan-out">Fan-Out (split and process)</option>
                <option value="fan-in">Fan-In (aggregate results)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWorkflow}
                className="px-3 py-1.5 text-sm bg-cyan-900 text-cyan-300 rounded hover:bg-cyan-800"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
