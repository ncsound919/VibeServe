import { useState, useEffect, useCallback } from 'react';
import { useIDEStore } from '../stores/useIDEStore';

interface Suggestion {
  id: string;
  type: 'fix' | 'refactor' | 'test' | 'reuse' | 'docs';
  title: string;
  description: string;
  file?: string;
  symbol?: string;
  repo: string;
  agenda_item?: string;
  confidence: number; // 0-100
}

export function ActiveSuggestionsPanel() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const { openFile } = useIDEStore();

  const generateSuggestions = useCallback(() => {
    setLoading(true);
    const demo: Suggestion[] = [
      {
        id: 's-1',
        type: 'refactor',
        title: 'Split large file',
        description: 'ide/src/services/pipelineService.ts has 30+ exported symbols — consider splitting into focused services.',
        file: 'ide/src/services/pipelineService.ts',
        repo: 'VibeServe',
        confidence: 78,
      },
      {
        id: 's-2',
        type: 'test',
        title: 'Add test coverage',
        description: 'vibeserve/tools/agenda.py — Agenda.add_entry has no corresponding test.',
        file: 'vibeserve/tools/agenda.py',
        symbol: 'Agenda.add_entry',
        repo: 'VibeServe',
        confidence: 92,
      },
      {
        id: 's-3',
        type: 'reuse',
        title: 'Reuse Button component',
        description: 'Button.tsx in the IDE shares 80% signature with Button in codenexus — deduplicate.',
        file: 'ide/src/components/lib/Button.tsx',
        repo: 'VibeServe',
        confidence: 85,
      },
      {
        id: 's-4',
        type: 'fix',
        title: 'Command injection risk',
        description: 'ide/src/server/routes/tasks.ts uses execAsync with unsanitized user input.',
        file: 'ide/src/server/routes/tasks.ts',
        repo: 'VibeServe',
        confidence: 95,
      },
    ];
    setSuggestions(demo);
    setLoading(false);
  }, []);

  useEffect(() => { generateSuggestions(); }, [generateSuggestions]);

  const typeIcons: Record<string, string> = {
    fix: '\u26A0',      // ⚠
    refactor: '\u2699', // ⚙
    test: '\u2714',     // ✔
    reuse: '\u21C4',    // ⇄
    docs: '\u2139',     // ℹ
  };

  const typeColors: Record<string, string> = {
    fix: '#f38ba8',
    refactor: '#89b4fa',
    test: '#a6e3a1',
    reuse: '#cba6f7',
    docs: '#f9e2af',
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary, #1e1e2e)' }}>
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border, #313244)' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted, #6c7086)' }}>
          Active Suggestions
        </span>
        <button
          onClick={generateSuggestions}
          className="text-xs px-2 py-0.5 rounded hover:brightness-110"
          style={{ backgroundColor: 'var(--bg-tertiary, #313244)', color: 'var(--text-muted, #6c7086)' }}
        >
          {loading ? 'Analyzing...' : 'Refresh'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {suggestions.length === 0 ? (
          <div className="text-xs py-4 text-center" style={{ color: 'var(--text-muted, #6c7086)' }}>
            No suggestions yet. Index your repo and set an agenda to get actionable suggestions.
          </div>
        ) : (
          <div className="space-y-2">
            {suggestions.map((s) => (
              <div
                key={s.id}
                className="p-2 rounded cursor-pointer hover:brightness-110 transition-colors"
                style={{ backgroundColor: 'var(--bg-tertiary, #313244)', borderLeft: `3px solid ${typeColors[s.type] || '#6c7086'}` }}
                onClick={() => s.file && openFile(s.file, s.file.split('/').pop() || 'unknown', 'typescript')}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{typeIcons[s.type] || '?'}</span>
                  <div className="flex-1">
                    <div className="text-xs font-medium" style={{ color: 'var(--text-primary, #cdd6f4)' }}>
                      {s.title}
                    </div>
                    <div className="text-xxs mt-0.5" style={{ color: 'var(--text-muted, #6c7086)' }}>
                      {s.description}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="text-xxs px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: (typeColors[s.type] || '#6c7086') + '22', color: typeColors[s.type] }}
                      >
                        {s.type}
                      </span>
                      {s.file && (
                        <span className="text-xxs" style={{ color: 'var(--text-muted, #6c7086)' }}>
                          {s.file}
                        </span>
                      )}
                      <div className="flex-1" />
                      <div className="flex items-center gap-1">
                        <div className="h-1.5 w-12 rounded-full" style={{ backgroundColor: 'var(--bg-primary, #1e1e2e)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${s.confidence}%`,
                              backgroundColor: s.confidence > 80 ? 'var(--success, #a6e3a1)' : s.confidence > 50 ? 'var(--warning, #f9e2af)' : 'var(--error, #f38ba8)',
                            }}
                          />
                        </div>
                        <span className="text-xxs" style={{ color: 'var(--text-muted, #6c7086)' }}>
                          {s.confidence}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
