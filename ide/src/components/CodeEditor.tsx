import Editor, { type Monaco } from '@monaco-editor/react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Save, Copy, FileCode, ChevronDown, Keyboard, Search, GitCompare, Users } from 'lucide-react';
import { useMemoryStore } from '../core/agents/memory/memoryStore';
import { useContextIndex, extractSymbols } from '../services/contextIndex';
import { symbolCache, memoryCache, completionCache, measureLatency } from '../services/lru-cache';
import { useRulesStore, checkCodeAgainstRules } from '../services/project-rules';
import {
  fetchInlineCompletion,
  getLocalInlineCompletion,
  clearCompletionDebounce,
} from '../services/inlineCompletionService';
import {
  getCollabSession,
  disconnectAllCollabSessions,
  type CollabSession,
  type CollaboratorPresence,
} from '../services/collaborationService';

interface CodeEditorProps {
  path?: string;
  language?: string;
  readOnly?: boolean;
  onSave?: (value: string) => void;
}

const LANGUAGE_OPTIONS = [
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'json', label: 'JSON' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'markdown', label: 'Markdown' },
];

let vimLoaded = false;

export function CodeEditor({
  path,
  language = 'typescript',
  readOnly = false,
  onSave,
}: CodeEditorProps) {
  const [value, setValue] = useState('// Start coding here...');
  const [currentLanguage, setCurrentLanguage] = useState(language);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [fileName, setFileName] = useState(path?.split('/').pop() || 'editor.ts');
  const [vimEnabled, setVimEnabled] = useState(false);
  const [vimMode, setVimMode] = useState<string>('NORMAL');
  const [collabEnabled, setCollabEnabled] = useState(false);
  const [collabConnected, setCollabConnected] = useState(false);
  const collabSessionRef = useRef<CollabSession | null>(null);
  const editorRef = useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const vimStatusRef = useRef<import('monaco-editor').IDisposable | null>(null);

  const handleChange = useCallback(
    (v: string | undefined) => {
      const newValue = v || '';
      setValue(newValue);
      const symbols = extractSymbols(newValue, fileName);
      useContextIndex.getState().addFile(fileName, symbols);
    },
    [fileName],
  );

  // Rule violation markers
  useEffect(() => {
    if (!editorRef.current || readOnly) return;
    const monaco = monacoRef.current;
    if (!monaco) return;

    const model = editorRef.current.getModel();
    if (!model) return;

    const rules = useRulesStore.getState().getEnabledRules();
    const violations = checkCodeAgainstRules(value, rules);

    const markers = violations.map((v) => {
      const lines = value.split('\n');
      return {
        severity: monaco.MarkerSeverity.Warning,
        message: v.message,
        startLineNumber: v.line,
        startColumn: 1,
        endLineNumber: v.line,
        endColumn: (lines[v.line - 1] || '').length + 1,
        source: v.rule,
      };
    });

    monaco.editor.setModelMarkers(model, 'nexus-rules', markers);
  }, [value, readOnly]);

  // Toggle vim mode
  const toggleVim = useCallback(async () => {
    const monaco = monacoRef.current;
    if (!monaco) return;

    const editor = editorRef.current;
    if (!editor) return;

    if (!vimEnabled) {
      try {
        const { initVimMode } = await import('monaco-vim');
        vimLoaded = true;

        // Dispose previous vim status if exists
        if (vimStatusRef.current) {
          vimStatusRef.current.dispose();
        }

        vimStatusRef.current = initVimMode(editor, document.getElementById('vim-status-bar'));
        setVimEnabled(true);
        setVimMode('NORMAL');

        // Listen for vim mode changes via polling the status bar
        const checkMode = setInterval(() => {
          const el = document.getElementById('vim-status-bar');
          if (el) {
            const text = el.textContent || '';
            if (text.includes('-- INSERT --')) setVimMode('INSERT');
            else if (text.includes('-- VISUAL --')) setVimMode('VISUAL');
            else if (text.includes('-- NORMAL --') || !text) setVimMode('NORMAL');
          }
        }, 200);

        // Store cleanup
        const cleanup = vimStatusRef.current;
        vimStatusRef.current = {
          dispose: () => {
            clearInterval(checkMode);
            cleanup?.dispose?.();
          },
        } as import('monaco-editor').IDisposable;
      } catch (e) {
        console.error('Failed to load vim mode:', e);
      }
    } else {
      if (vimStatusRef.current) {
        vimStatusRef.current.dispose();
        vimStatusRef.current = null;
      }
      setVimEnabled(false);
      setVimMode('');
    }
  }, [vimEnabled]);

  // Toggle collaboration
  const toggleCollab = useCallback(() => {
    if (collabEnabled) {
      if (collabSessionRef.current) {
        collabSessionRef.current.disconnect();
        collabSessionRef.current = null;
      }
      setCollabEnabled(false);
      setCollabConnected(false);
    } else {
      const room = fileName.replace(/[^a-zA-Z0-9]/g, '_');
      const userName = `user_${Math.random().toString(36).slice(2, 7)}`;
      const session = getCollabSession(room, userName);
      collabSessionRef.current = session;

      session.onConnectionChange = (connected: boolean) => setCollabConnected(connected);
      session.onPresenceChange = (presences: CollaboratorPresence[]) => {
        session.updateRemoteCursors(presences);
      };

      // Bind to editor if already mounted
      if (editorRef.current) {
        session.bindEditor(editorRef.current);
      }

      setCollabEnabled(true);
    }
  }, [collabEnabled, fileName]);

  const handleBeforeMount = useCallback(
    (monaco: Monaco) => {
      monacoRef.current = monaco;

      // Register code actions provider
      monaco.languages.registerCodeActionProvider('typescript', {
        provideCodeActions: (model: import('monaco-editor').editor.ITextModel, range: import('monaco-editor').IRange) => {
          const content = model.getValue();
          const violations = checkCodeAgainstRules(
            content,
            useRulesStore.getState().getEnabledRules(),
          );

          const actions: import('monaco-editor').languages.CodeAction[] = [];
          violations.forEach((v: any) => {
            if (v.line >= range.startLineNumber && v.line <= range.endLineNumber) {
              if (v.rule === 'No console.log' && content.includes('console.log')) {
                actions.push({
                  title: 'Remove console.log',
                  kind: 'quickfix',
                  edit: {
                    edits: [
                      {
                        resource: model.uri,
                        textEdit: {
                          range: {
                            startLineNumber: v.line,
                            startColumn:
                              content.split('\n')[v.line - 1].indexOf('console.log') + 1,
                            endLineNumber: v.line,
                            endColumn:
                              content.split('\n')[v.line - 1].indexOf('console.log') +
                              'console.log'.length +
                              1,
                          },
                          text: '',
                        },
                      } as import('monaco-editor').languages.IWorkspaceTextEdit,
                    ],
                  } as import('monaco-editor').languages.WorkspaceEdit,
                });
              }
            }
          });
          return { actions, dispose: () => {} };
        },
      });

      // Register standard completion provider
      monaco.languages.registerCompletionItemProvider('typescript', {
        provideCompletionItems: (model: import('monaco-editor').editor.ITextModel, position: import('monaco-editor').Position) => {
          const wordInfo = model.getWordUntilPosition(position);
          const word = wordInfo.word || '';
          const cacheKey = `${fileName}:${word}:${model.getLineContent(position.lineNumber).slice(0, 50)}`;

          const cached = completionCache.get(cacheKey) as import('monaco-editor').languages.CompletionItem[] | undefined;
          if (cached) return { suggestions: cached };

          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: wordInfo.startColumn,
            endColumn: wordInfo.endColumn,
          };

          const suggestions: import('monaco-editor').languages.CompletionItem[] = [];

          // Memory completions
          const memoryKey = 'memories:semantic:3';
          let memories: unknown = memoryCache.get(memoryKey);
          if (!memories) {
              try {
              memories = useMemoryStore().query({ tier: 'semantic', limit: 3 });
              memoryCache.set(memoryKey, memories as any);
            } catch {
              memories = [];
            }
          }
          if (Array.isArray(memories)) {
            memories.forEach((mem: any) => {
              suggestions.push({
                label: `\u{1F9E0} ${mem.content?.slice(0, 35) || 'Memory'}...`,
                kind: monaco.languages.CompletionItemKind.Snippet,
                detail: 'From memory',
                insertText: mem.content || '',
                range,
              } as import('monaco-editor').languages.CompletionItem);
            });
          }

          // Symbol completions
          let symbols = symbolCache.get(fileName) as any[] | undefined;
          if (!symbols) {
            const content = model.getValue();
            symbols = extractSymbols(content, fileName);
            symbolCache.set(fileName, symbols);
          }
          symbols.slice(0, 8).forEach((sym: any) => {
            suggestions.push({
              label: sym.name,
              kind:
                sym.kind === 'function'
                  ? monaco.languages.CompletionItemKind.Function
                  : sym.kind === 'class'
                    ? monaco.languages.CompletionItemKind.Class
                    : monaco.languages.CompletionItemKind.Variable,
              detail: `Line ${sym.line} \u2022 ${sym.kind}`,
              insertText: sym.name,
              range,
            } as import('monaco-editor').languages.CompletionItem);
          });

          completionCache.set(cacheKey, suggestions as any);
          return { suggestions };
        },
      });
    },
    [fileName],
  );

  const handleMount = useCallback(
    (editor: import('monaco-editor').editor.IStandaloneCodeEditor, monaco: Monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      const disposables: import('monaco-editor').IDisposable[] = [];
      const langRef = { current: currentLanguage };
      const fileRef = { current: fileName };

      // Update refs when language/fileName changes (without re-mounting)
      langRef.current = currentLanguage;
      fileRef.current = fileName;

      // Register inline completion provider for ALL supported languages
      const supportedLanguages = ['typescript', 'javascript', 'python', 'json', 'html', 'css', 'markdown'];

      for (const lang of supportedLanguages) {
        const disposable = monaco.languages.registerInlineCompletionsProvider(
          lang,
          {
            provideInlineCompletions: async (
              model: import('monaco-editor').editor.ITextModel,
              position: import('monaco-editor').Position,
              _context: import('monaco-editor').languages.InlineCompletionContext,
              token: import('monaco-editor').CancellationToken,
            ) => {
              // Use refs for latest language/filename without re-registering
              const lang = langRef.current;
              const fname = fileRef.current;
              const code = model.getValue();
              const lineNumber = position.lineNumber;
              const column = position.column;

              // Fast local completion (instant, synchronous)
              const localCompletion = getLocalInlineCompletion(code, lineNumber, column, lang);
              if (localCompletion) {
                return {
                  items: [
                    {
                      insertText: localCompletion,
                      range: new monaco.Range(lineNumber, column, lineNumber, column),
                    },
                  ],
                } as import('monaco-editor').languages.InlineCompletions;
              }

              // Check cancellation
              if (token.isCancellationRequested) return { items: [] };

              // AI completion (async, cancellable)
              try {
                const result = await fetchInlineCompletion({
                  code,
                  position: { lineNumber, column },
                  language: lang,
                  fileName: fname,
                });

                if (token.isCancellationRequested || !result?.text) {
                  return { items: [] };
                }

                return {
                  items: [
                    {
                      insertText: result.text,
                      range: new monaco.Range(lineNumber, column, lineNumber, column),
                    },
                  ],
                } as import('monaco-editor').languages.InlineCompletions;
              } catch {
                return { items: [] };
              }
            },
            freeInlineCompletions: () => {},
          },
        );
        disposables.push(disposable);
      }

      // Cleanup previous disposables
      const prev = (editor as any).__vibeserve_disposables as import('monaco-editor').IDisposable[] | undefined;
      if (prev) {
        for (const d of prev) {
          try { d.dispose(); } catch { /* ignore */ }
        }
      }
      (editor as any).__vibeserve_disposables = disposables;

      // Bind collab session if active
      if (collabSessionRef.current?.isConnected) {
        collabSessionRef.current.bindEditor(editor);
      }
    },
    [currentLanguage, fileName],
  );

  const handleSave = () => {
    if (onSave) onSave(value);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] rounded-xl overflow-hidden border border-[#21262d]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#161b22] border-b border-[#21262d]">
        <div className="flex items-center gap-3">
          <FileCode className="w-4 h-4 text-[#7d8590]" />
          <span className="text-sm text-[#c9d1d9] font-mono">{fileName}</span>

          {/* Vim mode indicator */}
          {vimEnabled && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1f6feb]/20 text-[#58a6ff] border border-[#1f6feb]/30">
              {vimMode}
            </span>
          )}
        </div>

          <div className="flex items-center gap-1">
          {/* Vim toggle */}
          <button
            onClick={toggleVim}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
              vimEnabled
                ? 'bg-[#1f6feb]/20 text-[#58a6ff] border border-[#1f6feb]/30'
                : 'text-[#7d8590] hover:text-[#c9d1d9] hover:bg-[#21262d]'
            }`}
            title="Toggle Vim mode"
          >
            <Keyboard className="w-3 h-3" />
            Vim
          </button>

          {/* Collab toggle */}
          <button
            onClick={toggleCollab}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
              collabEnabled
                ? 'bg-[#2ea043]/20 text-[#3fb950] border border-[#2ea043]/30'
                : 'text-[#7d8590] hover:text-[#c9d1d9] hover:bg-[#21262d]'
            }`}
            title="Toggle real-time collaboration"
          >
            <Users className="w-3 h-3" />
            {collabConnected ? 'Live' : 'Share'}
          </button>

          {/* Language selector */}
          <div className="relative">
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-[#7d8590] hover:text-[#c9d1d9] hover:bg-[#21262d] rounded"
            >
              {LANGUAGE_OPTIONS.find((l) => l.value === currentLanguage)?.label || currentLanguage}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showLangMenu && (
              <div className="absolute top-full right-0 mt-1 bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl z-10 min-w-[140px]">
                {LANGUAGE_OPTIONS.map((lang) => (
                  <button
                    key={lang.value}
                    onClick={() => {
                      setCurrentLanguage(lang.value);
                      setFileName(
                        `file.${lang.value === 'typescript' ? 'ts' : lang.value === 'javascript' ? 'js' : lang.value}`,
                      );
                      setShowLangMenu(false);
                    }}
                    className="block w-full text-left px-3 py-1.5 text-sm text-[#c9d1d9] hover:bg-[#1f6feb]/20 hover:text-[#58a6ff] first:rounded-t-lg last:rounded-b-lg"
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!readOnly && (
            <button
              onClick={handleSave}
              className="flex items-center gap-1 px-2 py-1 text-xs text-[#7d8590] hover:text-[#3fb950] hover:bg-[#21262d] rounded transition-colors"
            >
              <Save className="w-3 h-3" />
              Save
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 text-xs text-[#7d8590] hover:text-[#c9d1d9] hover:bg-[#21262d] rounded transition-colors"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={currentLanguage}
          value={value}
          onChange={handleChange}
          theme="vs-dark"
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 16 },
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontLigatures: true,
            quickSuggestions: true,
            folding: true,
            foldingHighlight: true,
            inlineSuggest: { enabled: true },
            suggest: {
              showInlineDetails: true,
              showKeywords: true,
              showSnippets: true,
              showClasses: true,
              showFunctions: true,
              preview: true,
              previewMode: 'subword',
            },
            tabCompletion: 'on',
            wordBasedSuggestions: 'currentDocument',
            bracketPairColorization: { enabled: true },
            guides: { indentation: true, bracketPairs: true },
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'explicit',
            renderWhitespace: 'selection',
          }}
        />
      </div>

      {/* Vim status bar (hidden element used by monaco-vim) */}
      <div
        id="vim-status-bar"
        className="hidden"
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
      />
    </div>
  );
}
