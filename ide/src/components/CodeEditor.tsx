import Editor from '@monaco-editor/react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Save, Copy, FileCode, ChevronDown, Lightbulb } from 'lucide-react';
import { useMemoryStore } from '../core/agents/memory/memoryStore';
import { useContextIndex, extractSymbols } from '../services/contextIndex';
import { symbolCache, memoryCache, completionCache, measureLatency } from '../services/lru-cache';
import { useRulesStore, checkCodeAgainstRules } from '../services/project-rules';

interface CodeEditorProps {
  initialValue?: string;
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

export function CodeEditor({ 
  initialValue = '// Start coding here...', 
  language = 'typescript',
  readOnly = false,
  onSave 
}: CodeEditorProps) {
  const [value, setValue] = useState(initialValue);
  const [currentLanguage, setCurrentLanguage] = useState(language);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [fileName, setFileName] = useState('editor.ts');
  const editorRef = useRef<any>(null);

  const handleChange = useCallback((v: string | undefined) => {
    const newValue = v || '';
    setValue(newValue);
    const symbols = extractSymbols(newValue, fileName);
    useContextIndex.getState().addFile(fileName, symbols);
  }, [fileName]);

  // Check for rule violations and set markers
  useEffect(() => {
    if (!editorRef.current || readOnly) return;

    const monaco = (window as any).monaco;
    if (!monaco) return;

    const model = monaco.editor.getActiveModel();
    if (!model) return;

    const rules = useRulesStore.getState().getEnabledRules();
    const violations = checkCodeAgainstRules(value, rules);

    const markers = violations.map(v => {
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

  const handleBeforeMount = useCallback((monaco: any) => {
    // Store editor instance
    editorRef.current = monaco.editor.getActiveModel();
    // Store editor reference
    editorRef.current = monaco.editor.getActiveModel()?.uri;

    // Register code actions provider for inline fixes (TypeScript)
    monaco.languages.registerCodeActionProvider('typescript', {
      provideCodeActions: (model: any, range: any) => {
        const content = model.getValue();
        const violations = checkCodeAgainstRules(
          content,
          useRulesStore.getState().getEnabledRules()
        );

        const actions: any[] = [];
        violations.forEach((v: any) => {
          if (v.line >= range.startLineNumber && v.line <= range.endLineNumber) {
            if (v.rule === 'No console.log' && content.includes('console.log')) {
              actions.push({
                title: 'Remove console.log',
                kind: 'quickfix',
                edit: {
                  edits: [{
                    resource: model.uri,
                    textEdit: {
                      range: {
                        startLineNumber: v.line,
                        startColumn: content.split('\n')[v.line - 1].indexOf('console.log') + 1,
                        endLineNumber: v.line,
                        endColumn: content.split('\n')[v.line - 1].indexOf('console.log') + 'console.log'.length + 1,
                      },
                      text: '',
                    },
                  }],
                },
              });
            }
            actions.push({
              title: 'Disable rule: ' + v.rule,
              kind: 'refactor',
              edit: {
                edits: [{
                  resource: model.uri,
                  textEdit: {
                    range,
                    text: content,
                  },
                }],
              },
            });
          }
        });

        return { actions };
      },
    });

    // Register completion provider
    monaco.languages.registerCompletionItemProvider('typescript', {
      provideCompletionItems: (model: any, position: any) => {
        const wordInfo = model.getWordUntilPosition(position);
        const word = wordInfo.word || '';
        const cacheKey = `${fileName}:${word}:${model.getLineContent(position.lineNumber).slice(0, 50)}`;

        // Check cache first (<1ms lookup)
        const cached = completionCache.get(cacheKey);
        if (cached) {
          return { suggestions: cached };
        }

        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: wordInfo.startColumn,
          endColumn: wordInfo.endColumn,
        };

        const suggestions: any[] = [];

        // Use cached memory results or query
        const memoryKey = 'memories:semantic:3';
        let memories = memoryCache.get(memoryKey);
        if (!memories) {
          const memoryStore = useMemoryStore.getState();
          memories = memoryStore.query({ tier: 'semantic', limit: 3 });
          memoryCache.set(memoryKey, memories);
        }
        memories.forEach((mem: any) => {
          suggestions.push({
            label: `🧠 ${mem.content?.slice(0, 25) || 'Memory'}...`,
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: 'From memory',
            insertText: mem.content || '',
            range,
          });
        });

        // Use cached symbols or extract
        let symbols = symbolCache.get(fileName);
        if (!symbols) {
          const content = model.getValue();
          symbols = extractSymbols(content, fileName);
          symbolCache.set(fileName, symbols);
        }
        symbols.slice(0, 8).forEach((sym: any) => {
          suggestions.push({
            label: sym.name,
            kind: sym.kind === 'function' 
              ? monaco.languages.CompletionItemKind.Function
              : sym.kind === 'class'
              ? monaco.languages.CompletionItemKind.Class
              : monaco.languages.CompletionItemKind.Variable,
            detail: `Line ${sym.line} • ${sym.kind}`,
            insertText: sym.name,
            range,
          });
        });

        // Cache the results
        completionCache.set(cacheKey, suggestions);

        return { suggestions };
      },
    });
  }, [fileName]);

  const handleSave = () => {
    if (onSave) {
      onSave(value);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] rounded-lg overflow-hidden border border-gray-800">
      <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-gray-800">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-300">{fileName}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <button 
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded"
            >
              {LANGUAGE_OPTIONS.find(l => l.value === currentLanguage)?.label || currentLanguage}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showLangMenu && (
              <div className="absolute top-full right-0 mt-1 bg-[#1e1e1e] border border-gray-700 rounded-lg shadow-xl z-10">
                {LANGUAGE_OPTIONS.map(lang => (
                  <button
                    key={lang.value}
                    onClick={() => {
                      setCurrentLanguage(lang.value);
                      setFileName(`file.${lang.value === 'typescript' ? 'ts' : lang.value === 'javascript' ? 'js' : lang.value}`);
                      setShowLangMenu(false);
                    }}
                    className="block w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
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
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-emerald-400 hover:bg-gray-800 rounded"
            >
              <Save className="w-3 h-3" />
              Save
            </button>
          )}
          <button 
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={currentLanguage}
          value={value}
          onChange={handleChange}
          theme="vs-dark"
          beforeMount={handleBeforeMount}
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 16 },
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            quickSuggestions: true,
            quickFix: { enabled: true },
            folding: true,
            foldingHighlight: true,
          }}
        />
      </div>
    </div>
  );
}
