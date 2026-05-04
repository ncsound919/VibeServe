import { useState } from 'react';
import { PreviewPanel } from '../components/PreviewPanel';
import { DiffViewer } from '../components/DiffViewer';
import { GitCompare, Eye, Layers } from 'lucide-react';

export default function ChangesTab() {
  const [viewMode, setViewMode] = useState<'diff' | 'preview' | 'split'>('diff');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            {viewMode === 'diff' && <GitCompare className="w-5 h-5 text-indigo-400" />}
            {viewMode === 'preview' && <Eye className="w-5 h-5 text-indigo-400" />}
            {viewMode === 'split' && <Layers className="w-5 h-5 text-indigo-400" />}
            Changes & Preview
          </h1>
          <p className="text-sm text-gray-400 mt-1">Review generated code and interactive previews</p>
        </div>

        <div className="flex items-center gap-1 bg-[#1a1a1c] rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('diff')}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              viewMode === 'diff' ? 'bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:text-white'
            }`}
          >
            Diff Viewer
          </button>
          <button
            onClick={() => setViewMode('preview')}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              viewMode === 'preview' ? 'bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:text-white'
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              viewMode === 'split' ? 'bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:text-white'
            }`}
          >
            Split View
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 p-4">
        {viewMode === 'diff' && <DiffViewer />}
        {viewMode === 'preview' && <PreviewPanel />}
        {viewMode === 'split' && (
          <div className="grid grid-cols-2 gap-4 h-full">
            <DiffViewer />
            <PreviewPanel />
          </div>
        )}
      </div>
    </div>
  );
}
