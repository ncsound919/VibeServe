import { useState } from 'react';
import { useExtensionHost } from '../../extensions/ExtensionHost';
import { SAMPLE_EXTENSION, type ExtensionManifest } from '../../extensions/types';
import { Package, Play, Power, Trash2, Plus, Info, Zap } from 'lucide-react';

export function ExtensionsPanel() {
  const { extensions, loadExtension, enableExtension, disableExtension, unloadExtension, getEnabledExtensions } = useExtensionHost();
  const [selectedExt, setSelectedExt] = useState<string | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);

  const handleLoadSample = () => {
    try {
      loadExtension(SAMPLE_EXTENSION);
      setInstallError(null);
    } catch (e) {
      setInstallError(e instanceof Error ? e.message : 'Failed to load');
    }
  };

  const extensionList = Object.values(extensions);
  const enabledCount = getEnabledExtensions().length;

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Package className="w-5 h-5" />
            Extensions
          </h2>
          <span className="text-xs text-slate-500">
            {enabledCount} / {extensionList.length} enabled
          </span>
        </div>

        <button
          onClick={handleLoadSample}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Load Sample Extension
        </button>

        {installError && (
          <p className="mt-2 text-xs text-red-400">{installError}</p>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {extensionList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Package className="w-12 h-12 mb-3 opacity-30" />
            <p>No extensions loaded</p>
            <p className="text-xs mt-2">Click "Load Sample Extension" to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {extensionList.map((ext) => (
              <div
                key={ext.manifest.name}
                className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                  selectedExt === ext.manifest.name 
                    ? 'bg-slate-800 border-blue-500' 
                    : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                }`}
                onClick={() => setSelectedExt(ext.manifest.name)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-slate-200">{ext.manifest.name}</h3>
                    <p className="text-xs text-slate-500">v{ext.manifest.version}</p>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      ext.enabled 
                        ? disableExtension(ext.manifest.name) 
                        : enableExtension(ext.manifest.name);
                    }}
                    className={`p-1.5 rounded ${ext.enabled ? 'bg-emerald-600' : 'bg-slate-700'}`}
                    title={ext.enabled ? 'Disable' : 'Enable'}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-sm text-slate-400 mb-3">{ext.manifest.description}</p>

                <div className="flex items-center gap-2 flex-wrap">
                  {ext.manifest.tags?.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-400">
                      {tag}
                    </span>
                  ))}
                </div>

                {ext.manifest.hooks.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <p className="text-xs text-slate-500 mb-1">Hooks:</p>
                    <div className="flex gap-1 flex-wrap">
                      {ext.manifest.hooks.map(hook => (
                        <span key={hook.event} className="px-2 py-0.5 bg-purple-600/20 text-purple-400 rounded text-xs">
                          {hook.event}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedExt === ext.manifest.name && (
                  <div className="mt-3 pt-3 border-t border-slate-700 flex gap-2">
                    <button className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs">
                      <Zap className="w-3 h-3" />
                      Configure
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        unloadExtension(ext.manifest.name);
                      }}
                      className="flex items-center gap-1 px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-xs"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-700 bg-slate-800/50">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Info className="w-4 h-4" />
          <span>Extensions allow you to add custom hooks and integrations</span>
        </div>
      </div>
    </div>
  );
}
