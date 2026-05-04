import { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Shield, Lock, Eye, EyeOff, Server, Globe, Key, 
  AlertTriangle, CheckCircle, Info, RefreshCw, Save
} from 'lucide-react';

interface PrivacySettings {
  localFirstMode: boolean;
  ollamaEndpoint: string;
  storeCodeLocally: boolean;
  autoDeleteTempFiles: boolean;
  sensitiveDataScanning: boolean;
  telemetryEnabled: boolean;
  sandboxMode: 'strict' | 'moderate' | 'off';
}

interface SecuritySettings {
  apiKeyMasked: boolean;
  secretRotationDays: number;
  scanGeneratedCode: boolean;
  verifyBeforeApply: boolean;
  auditLogging: boolean;
}

export function PrivacySecuritySettings() {
  const [privacy, setPrivacy] = useState<PrivacySettings>({
    localFirstMode: false,
    ollamaEndpoint: 'http://localhost:11434',
    storeCodeLocally: true,
    autoDeleteTempFiles: true,
    sensitiveDataScanning: true,
    telemetryEnabled: false,
    sandboxMode: 'moderate',
  });

  const [security, setSecurity] = useState<SecuritySettings>({
    apiKeyMasked: true,
    secretRotationDays: 90,
    scanGeneratedCode: true,
    verifyBeforeApply: true,
    auditLogging: true,
  });

  const [testingOllama, setTestingOllama] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const testOllamaConnection = async () => {
    setTestingOllama(true);
    setOllamaStatus('idle');
    try {
      const response = await fetch(`${privacy.ollamaEndpoint}/api/tags`, { method: 'GET' });
      if (response.ok) {
        setOllamaStatus('success');
      } else {
        setOllamaStatus('error');
      }
    } catch {
      setOllamaStatus('error');
    }
    setTestingOllama(false);
  };

  const updatePrivacy = (key: keyof PrivacySettings, value: any) => {
    setPrivacy({ ...privacy, [key]: value });
  };

  const updateSecurity = (key: keyof SecuritySettings, value: any) => {
    setSecurity({ ...security, [key]: value });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-indigo-400" />
        <h2 className="text-lg font-semibold text-white">Privacy & Security</h2>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-white font-medium pb-2 border-b border-gray-800">
            <Lock className="w-4 h-4 text-emerald-400" />
            Privacy Settings
          </div>

          <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm text-white">Local-First Mode</div>
                <div className="text-xs text-gray-500">Process code locally without cloud APIs</div>
              </div>
              <button
                onClick={() => updatePrivacy('localFirstMode', !privacy.localFirstMode)}
                className={`w-10 h-5 rounded-full transition-colors ${
                  privacy.localFirstMode ? 'bg-emerald-500' : 'bg-gray-700'
                }`}
              >
                <motion.div
                  animate={{ x: privacy.localFirstMode ? 20 : 2 }}
                  className="w-4 h-4 bg-white rounded-full"
                />
              </button>
            </div>

            {privacy.localFirstMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-3"
              >
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Ollama Endpoint</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={privacy.ollamaEndpoint}
                      onChange={(e) => updatePrivacy('ollamaEndpoint', e.target.value)}
                      className="flex-1 bg-[#1a1a1c] border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      onClick={testOllamaConnection}
                      disabled={testingOllama}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300 flex items-center gap-1 transition-colors"
                    >
                      {testingOllama ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Server className="w-3 h-3" />}
                      Test
                    </button>
                  </div>
                  {ollamaStatus === 'success' && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-emerald-400">
                      <CheckCircle className="w-3 h-3" /> Connected
                    </div>
                  )}
                  {ollamaStatus === 'error' && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-red-400">
                      <AlertTriangle className="w-3 h-3" /> Connection failed
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-800">
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="text-sm text-white">Store Code Locally</div>
                  <div className="text-xs text-gray-500">Cache code context on disk</div>
                </div>
                <input
                  type="checkbox"
                  checked={privacy.storeCodeLocally}
                  onChange={(e) => updatePrivacy('storeCodeLocally', e.target.checked)}
                  className="w-4 h-4 accent-emerald-500"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="text-sm text-white">Auto-delete Temp Files</div>
                  <div className="text-xs text-gray-500">Clean up generated files after session</div>
                </div>
                <input
                  type="checkbox"
                  checked={privacy.autoDeleteTempFiles}
                  onChange={(e) => updatePrivacy('autoDeleteTempFiles', e.target.checked)}
                  className="w-4 h-4 accent-emerald-500"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="text-sm text-white">Sensitive Data Scanning</div>
                  <div className="text-xs text-gray-500">Detect API keys, passwords in generated code</div>
                </div>
                <input
                  type="checkbox"
                  checked={privacy.sensitiveDataScanning}
                  onChange={(e) => updatePrivacy('sensitiveDataScanning', e.target.checked)}
                  className="w-4 h-4 accent-emerald-500"
                />
              </label>
            </div>
          </div>

          <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-800">
            <div className="mb-3">
              <div className="text-sm text-white">Sandbox Mode</div>
              <div className="text-xs text-gray-500">Restrict agent capabilities</div>
            </div>
            <div className="flex gap-2">
              {(['strict', 'moderate', 'off'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => updatePrivacy('sandboxMode', mode)}
                  className={`flex-1 px-3 py-2 rounded text-xs capitalize transition-colors ${
                    privacy.sandboxMode === mode
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'bg-[#1a1a1c] text-gray-400 hover:text-white border border-gray-700'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-white font-medium pb-2 border-b border-gray-800">
            <Key className="w-4 h-4 text-amber-400" />
            Security Settings
          </div>

          <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-800">
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="text-sm text-white">Mask API Keys</div>
                  <div className="text-xs text-gray-500">Hide keys in UI and logs</div>
                </div>
                <input
                  type="checkbox"
                  checked={security.apiKeyMasked}
                  onChange={(e) => updateSecurity('apiKeyMasked', e.target.checked)}
                  className="w-4 h-4 accent-emerald-500"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="text-sm text-white">Scan Generated Code</div>
                  <div className="text-xs text-gray-500">Analyze code for security issues</div>
                </div>
                <input
                  type="checkbox"
                  checked={security.scanGeneratedCode}
                  onChange={(e) => updateSecurity('scanGeneratedCode', e.target.checked)}
                  className="w-4 h-4 accent-emerald-500"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="text-sm text-white">Verify Before Apply</div>
                  <div className="text-xs text-gray-500">Review changes before applying</div>
                </div>
                <input
                  type="checkbox"
                  checked={security.verifyBeforeApply}
                  onChange={(e) => updateSecurity('verifyBeforeApply', e.target.checked)}
                  className="w-4 h-4 accent-emerald-500"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="text-sm text-white">Audit Logging</div>
                  <div className="text-xs text-gray-500">Log all security events</div>
                </div>
                <input
                  type="checkbox"
                  checked={security.auditLogging}
                  onChange={(e) => updateSecurity('auditLogging', e.target.checked)}
                  className="w-4 h-4 accent-emerald-500"
                />
              </label>
            </div>
          </div>

          <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-800">
            <div className="mb-3">
              <div className="text-sm text-white">Secret Rotation (days)</div>
              <div className="text-xs text-gray-500">Remind to rotate API keys</div>
            </div>
            <input
              type="range"
              min="30"
              max="180"
              step="30"
              value={security.secretRotationDays}
              onChange={(e) => updateSecurity('secretRotationDays', parseInt(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>30</span>
              <span className="text-white">{security.secretRotationDays} days</span>
              <span>180</span>
            </div>
          </div>

          <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5" />
              <div>
                <div className="text-sm text-amber-300">Security Notice</div>
                <div className="text-xs text-gray-400 mt-1">
                  Always verify generated code before applying. Review changes with the diff viewer.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
        <button className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
          Reset to Defaults
        </button>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded text-sm transition-colors">
          <Save className="w-4 h-4" />
          Save Changes
        </button>
      </div>
    </div>
  );
}
