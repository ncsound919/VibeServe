import { useState } from 'react';
import { User, Palette, Bell, Moon, Sun, Monitor, Layout, Code2, Sparkles, Keyboard } from 'lucide-react';

interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  editorTheme: string;
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  showMinimap: boolean;
  wordWrap: boolean;
  autoSave: boolean;
  autoSaveDelay: number;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  simpleMode: boolean;
  keyBindings: string;
}

const PRESETS = [
  { name: 'Developer', description: 'Full-featured IDE experience', icon: Code2 },
  { name: 'Simple', description: 'Easy to use, fewer options', icon: Sparkles },
  { name: 'Minimal', description: 'Just the essentials', icon: Layout },
];

const THEMES = [
  { value: 'vs-dark', label: 'Visual Studio Dark' },
  { value: 'vs-light', label: 'Visual Studio Light' },
  { value: 'hc-black', label: 'High Contrast Dark' },
  { value: 'github-dark', label: 'GitHub Dark' },
  { value: 'dracula', label: 'Dracula' },
];

export function PersonalizationPanel() {
  const [prefs, setPrefs] = useState<UserPreferences>({
    theme: 'dark',
    editorTheme: 'vs-dark',
    fontSize: 14,
    fontFamily: 'JetBrains Mono',
    tabSize: 2,
    showMinimap: false,
    wordWrap: false,
    autoSave: true,
    autoSaveDelay: 1000,
    notificationsEnabled: true,
    soundEnabled: false,
    simpleMode: false,
    keyBindings: 'default',
  });

  const [activeTab, setActiveTab] = useState<'appearance' | 'editor' | 'behavior' | 'shortcuts'>('appearance');

  const updatePref = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
  };

  const loadPreset = (preset: string) => {
    switch (preset) {
      case 'Developer':
        setPrefs(prev => ({ ...prev, simpleMode: false, showMinimap: true, autoSave: true }));
        break;
      case 'Simple':
        setPrefs(prev => ({ ...prev, simpleMode: true, showMinimap: false, autoSave: true }));
        break;
      case 'Minimal':
        setPrefs(prev => ({ ...prev, simpleMode: true, showMinimap: false, autoSave: false }));
        break;
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] text-gray-300">
      <div className="flex items-center gap-2 px-4 py-2 bg-[#252526] border-b border-gray-800">
        <User className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-medium text-white">Personalization</span>
      </div>

      <div className="flex border-b border-gray-800">
        {(['appearance', 'editor', 'behavior', 'shortcuts'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm capitalize ${activeTab === tab ? 'text-white border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-300'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'appearance' && (
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-white mb-3">Theme</h4>
              <div className="flex gap-2">
                {(['light', 'dark', 'system'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => updatePref('theme', t)}
                    className={`flex items-center gap-2 px-3 py-2 rounded ${prefs.theme === t ? 'bg-blue-900/50 text-blue-300 border border-blue-700' : 'bg-[#252526] text-gray-400'}`}
                  >
                    {t === 'light' && <Sun className="w-4 h-4" />}
                    {t === 'dark' && <Moon className="w-4 h-4" />}
                    {t === 'system' && <Monitor className="w-4 h-4" />}
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-white mb-3">Quick Presets</h4>
              <div className="grid grid-cols-3 gap-2">
                {PRESETS.map(preset => (
                  <button
                    key={preset.name}
                    onClick={() => loadPreset(preset.name)}
                    className="flex flex-col items-center gap-2 p-3 bg-[#252526] rounded hover:bg-[#2d2d2d] transition-colors"
                  >
                    <preset.icon className="w-5 h-5 text-gray-400" />
                    <span className="text-xs text-gray-300">{preset.name}</span>
                    <span className="text-xs text-gray-500">{preset.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {prefs.simpleMode && (
              <div className="p-3 bg-purple-900/20 border border-purple-800 rounded">
                <p className="text-sm text-purple-300">Simple mode is enabled. Some options are hidden for a simpler experience.</p>
                <button
                  onClick={() => updatePref('simpleMode', false)}
                  className="mt-2 text-xs text-purple-400 hover:text-purple-300"
                >
                  Switch to full mode →
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'editor' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400">Editor Theme</label>
              <select
                value={prefs.editorTheme}
                onChange={(e) => updatePref('editorTheme', e.target.value)}
                className="w-full mt-1 bg-[#252526] border border-gray-700 rounded px-3 py-2 text-sm text-white"
              >
                {THEMES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-400">Font Size</label>
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="range"
                  min="10"
                  max="24"
                  value={prefs.fontSize}
                  onChange={(e) => updatePref('fontSize', parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm text-white w-8">{prefs.fontSize}px</span>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400">Font Family</label>
              <input
                type="text"
                value={prefs.fontFamily}
                onChange={(e) => updatePref('fontFamily', e.target.value)}
                className="w-full mt-1 bg-[#252526] border border-gray-700 rounded px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400">Tab Size</label>
              <select
                value={prefs.tabSize}
                onChange={(e) => updatePref('tabSize', parseInt(e.target.value))}
                className="w-full mt-1 bg-[#252526] border border-gray-700 rounded px-3 py-2 text-sm text-white"
              >
                <option value={2}>2 spaces</option>
                <option value={4}>4 spaces</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-300">Show Minimap</span>
              </div>
              <button
                onClick={() => updatePref('showMinimap', !prefs.showMinimap)}
                className={`w-10 h-5 rounded-full transition-colors ${prefs.showMinimap ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${prefs.showMinimap ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-300">Word Wrap</span>
              </div>
              <button
                onClick={() => updatePref('wordWrap', !prefs.wordWrap)}
                className={`w-10 h-5 rounded-full transition-colors ${prefs.wordWrap ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${prefs.wordWrap ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'behavior' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-300">Auto Save</span>
                <p className="text-xs text-gray-500">Automatically save files</p>
              </div>
              <button
                onClick={() => updatePref('autoSave', !prefs.autoSave)}
                className={`w-10 h-5 rounded-full transition-colors ${prefs.autoSave ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${prefs.autoSave ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {prefs.autoSave && (
              <div>
                <label className="text-sm text-gray-400">Auto Save Delay</label>
                <select
                  value={prefs.autoSaveDelay}
                  onChange={(e) => updatePref('autoSaveDelay', parseInt(e.target.value))}
                  className="w-full mt-1 bg-[#252526] border border-gray-700 rounded px-3 py-2 text-sm text-white"
                >
                  <option value={500}>500ms</option>
                  <option value={1000}>1 second</option>
                  <option value={2000}>2 seconds</option>
                  <option value={5000}>5 seconds</option>
                </select>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-300">Notifications</span>
              </div>
              <button
                onClick={() => updatePref('notificationsEnabled', !prefs.notificationsEnabled)}
                className={`w-10 h-5 rounded-full transition-colors ${prefs.notificationsEnabled ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${prefs.notificationsEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-300">Sound Effects</span>
              </div>
              <button
                onClick={() => updatePref('soundEnabled', !prefs.soundEnabled)}
                className={`w-10 h-5 rounded-full transition-colors ${prefs.soundEnabled ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${prefs.soundEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-300">Simple Mode</span>
                <p className="text-xs text-gray-500">Hide advanced options</p>
              </div>
              <button
                onClick={() => updatePref('simpleMode', !prefs.simpleMode)}
                className={`w-10 h-5 rounded-full transition-colors ${prefs.simpleMode ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${prefs.simpleMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'shortcuts' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400">Key Bindings</label>
              <select
                value={prefs.keyBindings}
                onChange={(e) => updatePref('keyBindings', e.target.value)}
                className="w-full mt-1 bg-[#252526] border border-gray-700 rounded px-3 py-2 text-sm text-white"
              >
                <option value="default">Default</option>
                <option value="vim">Vim</option>
                <option value="emacs">Emacs</option>
                <option value="vscode">VS Code</option>
              </select>
            </div>

            <div className="p-3 bg-[#252526] rounded">
              <h5 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                <Keyboard className="w-4 h-4" />
                Popular Shortcuts
              </h5>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Save file</span>
                  <kbd className="px-2 py-0.5 bg-gray-800 rounded">Ctrl+S</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Find</span>
                  <kbd className="px-2 py-0.5 bg-gray-800 rounded">Ctrl+F</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Command palette</span>
                  <kbd className="px-2 py-0.5 bg-gray-800 rounded">Ctrl+Shift+P</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Toggle terminal</span>
                  <kbd className="px-2 py-0.5 bg-gray-800 rounded">Ctrl+`</kbd>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function usePersonalizationStore() {
  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: 'dark',
    editorTheme: 'vs-dark',
    fontSize: 14,
    fontFamily: 'JetBrains Mono',
    tabSize: 2,
    showMinimap: false,
    wordWrap: false,
    autoSave: true,
    autoSaveDelay: 1000,
    notificationsEnabled: true,
    soundEnabled: false,
    simpleMode: false,
    keyBindings: 'default',
  });

  const updatePreference = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const savePreferences = () => {
    localStorage.setItem('nexus:preferences', JSON.stringify(preferences));
  };

  const loadPreferences = () => {
    try {
      const stored = localStorage.getItem('nexus:preferences');
      if (stored) {
        setPreferences({ ...preferences, ...JSON.parse(stored) });
      }
    } catch (e) {
      console.error('Failed to load preferences:', e);
    }
  };

  return { preferences, updatePreference, savePreferences, loadPreferences };
}
