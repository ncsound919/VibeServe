import { useState } from 'react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { Terminal, Cpu, Palette, Key, Save } from 'lucide-react';

const LLM_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
  { id: 'deepseek', name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-coder'] },
  { id: 'openrouter', name: 'OpenRouter', models: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o'] },
  { id: 'local', name: 'Local (Ollama)', models: ['llama3.2', 'codellama'] },
];

const THEMES = [
  { id: 'dark', name: 'Dark (Default)', preview: '#0d1117' },
  { id: 'light', name: 'Light', preview: '#ffffff' },
  { id: 'ocean', name: 'Ocean', preview: '#0a1929' },
  { id: 'forest', name: 'Forest', preview: '#0d1f0d' },
];

const FONT_SIZES = [12, 13, 14, 15, 16, 18];
const TAB_SIZES = [2, 4, 8];

export function SettingsPanel() {
  const settings = useSettingsStore();
  const [activeSection, setActiveSection] = useState<'editor' | 'llm' | 'keys' | 'theme'>('editor');
  const [envVars, setEnvVars] = useState<Record<string, string>>({
    OPENAI_API_KEY: '',
    DEEPSEEK_API_KEY: '',
    OPENROUTER_API_KEY: '',
  });

  const sections = [
    { id: 'editor', label: 'Editor', icon: Terminal },
    { id: 'llm', label: 'LLM', icon: Cpu },
    { id: 'theme', label: 'Theme', icon: Palette },
    { id: 'keys', label: 'API Keys', icon: Key },
  ] as const;

  return (
    <div className="flex h-full">
      <div className="w-32 shrink-0 flex flex-col border-r border-[var(--border)]" style={{ background: 'var(--bg-primary)' }}>
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-2 px-3 py-2.5 text-xs text-left transition-colors ${
              activeSection === s.id ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'text-[var(--text-muted)] hover:bg-[var(--border)]/30'
            }`}
          >
            <s.icon className="w-4 h-4" />
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeSection === 'editor' && <EditorSettings settings={settings} fontSizes={FONT_SIZES} tabSizes={TAB_SIZES} />}
        {activeSection === 'llm' && <LLMSettings settings={settings} providers={LLM_PROVIDERS} />}
        {activeSection === 'theme' && <ThemeSettings settings={settings} themes={THEMES} />}
        {activeSection === 'keys' && <APIKeySettings envVars={envVars} setEnvVars={setEnvVars} />}
      </div>
    </div>
  );
}

function EditorSettings({ settings, fontSizes, tabSizes }: { settings: any; fontSizes: number[]; tabSizes: number[] }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Editor Settings</h3>
      
      <SettingRow label="Font Size">
        <select
          value={settings.fontSize || 14}
          onChange={(e: any) => settings.setFontSize(Number(e.target.value))}
          className="px-2 py-1 text-xs rounded border bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-primary)]"
        >
          {fontSizes.map((s) => <option key={s} value={s}>{s}px</option>)}
        </select>
      </SettingRow>

      <SettingRow label="Tab Size">
        <select
          value={settings.tabSize || 2}
          onChange={(e: any) => settings.setTabSize(Number(e.target.value))}
          className="px-2 py-1 text-xs rounded border bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-primary)]"
        >
          {tabSizes.map((s) => <option key={s} value={s}>{s} spaces</option>)}
        </select>
      </SettingRow>
    </div>
  );
}

function LLMSettings({ settings, providers }: { settings: any; providers: typeof LLM_PROVIDERS }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">LLM Configuration</h3>
      
      <SettingRow label="Provider">
        <select
          value={settings.llmProvider || 'openai'}
          onChange={(e: any) => settings.setLLMProvider?.(e.target.value)}
          className="px-2 py-1 text-xs rounded border bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-primary)]"
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </SettingRow>

      <SettingRow label="Model">
        <select
          value={settings.llmModel || ''}
          onChange={(e: any) => settings.setLLMModel?.(e.target.value)}
          className="px-2 py-1 text-xs rounded border bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-primary)]"
        >
          {providers
            .find((p) => p.id === settings.llmProvider)?.models.map((m) => (
              <option key={m} value={m}>{m}</option>
            )) as any}
        </select>
      </SettingRow>

      <SettingRow label="Temperature">
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={settings.temperature || 0.7}
          onChange={(e: any) => settings.setTemperature?.(Number(e.target.value))}
          className="w-24"
        />
        <span className="text-xs text-[var(--text-muted)] ml-2">{settings.temperature || 0.7}</span>
      </SettingRow>
    </div>
  );
}

function ThemeSettings({ settings, themes }: { settings: any; themes: typeof THEMES }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Theme</h3>
      
      <div className="grid grid-cols-2 gap-2">
        {themes.map((t) => (
          <button
            key={t.id}
            onClick={() => settings.setTheme(t.id as any)}
            className={`p-3 rounded-lg border text-left transition-all ${
              settings.theme === t.id ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border)] hover:border-[var(--text-muted)]'
            }`}
          >
            <div className="w-full h-8 rounded mb-2" style={{ background: t.preview }} />
            <div className="text-xs text-[var(--text-primary)]">{t.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function APIKeySettings({ envVars, setEnvVars }: { envVars: Record<string, string>; setEnvVars: any }) {
  const handleSave = () => {
    console.log('Saving API keys:', Object.keys(envVars).filter((k) => envVars[k]));
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">API Keys</h3>
      <p className="text-xs text-[var(--text-muted)]">Keys are stored locally and never sent to external servers.</p>
      
      {Object.entries(envVars).map(([key, value]) => (
        <SettingRow key={key} label={key}>
          <input
            type="password"
            value={value}
            onChange={(e: any) => setEnvVars({ ...envVars, [key]: e.target.value })}
            placeholder={`Enter ${key}`}
            className="w-full px-2 py-1 text-xs rounded border bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-primary)]"
          />
        </SettingRow>
      ))}

      <button
        onClick={handleSave}
        className="flex items-center gap-2 px-3 py-1.5 text-xs rounded bg-[var(--accent)] text-white hover:opacity-90"
      >
        <Save className="w-3 h-3" />
        Save Keys
      </button>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      {children}
    </div>
  );
}