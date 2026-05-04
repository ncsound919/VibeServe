/**
 * Project Rules Panel
 * 
 * Manage project-specific coding standards and agent behavior rules.
 */
import { useState } from 'react';
import { ScrollText, Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { useRulesStore, ProjectRule } from '../../services/project-rules';

export const ProjectRulesPanel = () => {
  const { rules, addRule, removeRule, toggleRule } = useRulesStore();
  const [newRule, setNewRule] = useState({ name: '', content: '' });
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = () => {
    if (!newRule.name || !newRule.content) return;
    addRule({
      name: newRule.name,
      content: newRule.content,
      enabled: true,
      priority: rules.length + 1,
    });
    setNewRule({ name: '', content: '' });
    setIsAdding(false);
  };

  return (
    <div className="bg-[#1a1b1e]/50 border border-[#2d2e32] p-5 rounded-xl">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <ScrollText size={20} className="text-indigo-400" />
          <h2 className="text-sm font-medium text-white">Project Rules & Standards</h2>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1.5 text-[10px] font-mono px-3 py-1.5 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 transition-colors"
        >
          <Plus size={12} />
          Add Rule
        </button>
      </div>

      <div className="space-y-3">
        {isAdding && (
          <div className="p-4 rounded-lg border border-indigo-500/30 bg-indigo-500/5 space-y-3">
            <input
              type="text"
              placeholder="Rule Name (e.g. Naming Conventions)"
              value={newRule.name}
              onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
              className="w-full text-[11px] font-mono bg-[#0a0a0c] border border-[#2d2e32] rounded px-3 py-2 text-white outline-none focus:border-indigo-500/50"
            />
            <textarea
              placeholder="Rule Description (e.g. Use camelCase for all variables...)"
              value={newRule.content}
              onChange={(e) => setNewRule({ ...newRule, content: e.target.value })}
              className="w-full text-[11px] font-mono bg-[#0a0a0c] border border-[#2d2e32] rounded px-3 py-2 text-white outline-none focus:border-indigo-500/50 min-h-[80px]"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsAdding(false)}
                className="text-[10px] font-mono px-3 py-1.5 text-[#4a4b50] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                className="text-[10px] font-mono px-4 py-1.5 rounded bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
              >
                Save Rule
              </button>
            </div>
          </div>
        )}

        {rules.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-[#2d2e32] rounded-lg">
            <p className="text-[10px] text-[#4a4b50] italic">No rules defined for this project.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`p-4 rounded-lg border transition-all ${
                  rule.enabled ? 'border-[#2d2e32] bg-[#0a0a0c]/50' : 'border-[#1a1b1e] bg-[#0a0a0c]/20 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleRule(rule.id)}>
                      {rule.enabled ? (
                        <CheckCircle2 size={14} className="text-emerald-400" />
                      ) : (
                        <Circle size={14} className="text-[#4a4b50]" />
                      )}
                    </button>
                    <h3 className={`text-[11px] font-bold ${rule.enabled ? 'text-white' : 'text-[#4a4b50]'}`}>
                      {rule.name}
                    </h3>
                  </div>
                  <button
                    onClick={() => removeRule(rule.id)}
                    className="text-[#4a4b50] hover:text-rose-400 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <p className="text-[10px] text-[#8E9299] leading-relaxed line-clamp-2">
                  {rule.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 text-[9px] font-mono text-[#4a4b50]">
        <CheckCircle2 size={10} />
        <span>Rules are automatically synchronized with the Serena context engine.</span>
      </div>
    </div>
  );
};
