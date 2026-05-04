import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, Code, Image, FileText, ExternalLink, RefreshCw, X, LayoutTemplate, FileCode2 } from 'lucide-react';

interface PreviewArtifact {
  id: string;
  type: 'ui' | 'diagram' | 'code' | 'markdown' | 'json';
  title: string;
  content: string;
  timestamp: string;
}

interface PreviewPanelProps {
  artifacts?: PreviewArtifact[];
  onApply?: (artifactId: string) => void;
  onDismiss?: (artifactId: string) => void;
}

const mockArtifacts: PreviewArtifact[] = [
  { id: '1', type: 'ui', title: 'Button Component', content: '<button class="btn-primary">Click Me</button>', timestamp: new Date().toISOString() },
  { id: '2', type: 'diagram', title: 'Architecture Flow', content: 'graph TD\nA[User] --> B[API]\nB --> C[Database]', timestamp: new Date().toISOString() },
  { id: '3', type: 'code', title: 'Auth Hook', content: 'export function useAuth() {\n  // authentication logic\n}', timestamp: new Date().toISOString() },
];

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'ui': return <LayoutTemplate className="w-4 h-4" />;
    case 'diagram': return <Image className="w-4 h-4" />;
    case 'code': return <FileCode2 className="w-4 h-4" />;
    case 'markdown': return <FileText className="w-4 h-4" />;
    case 'json': return <Code className="w-4 h-4" />;
    default: return <FileText className="w-4 h-4" />;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'ui': return 'text-blue-400 bg-blue-500/20';
    case 'diagram': return 'text-purple-400 bg-purple-500/20';
    case 'code': return 'text-emerald-400 bg-emerald-500/20';
    case 'markdown': return 'text-amber-400 bg-amber-500/20';
    case 'json': return 'text-orange-400 bg-orange-500/20';
    default: return 'text-gray-400 bg-gray-500/20';
  }
};

export function PreviewPanel({ artifacts = mockArtifacts, onApply, onDismiss }: PreviewPanelProps) {
  const [selectedArtifact, setSelectedArtifact] = useState<string | null>(artifacts[0]?.id || null);
  const [viewMode, setViewMode] = useState<'split' | 'preview' | 'code'>('split');

  const activeArtifact = artifacts.find(a => a.id === selectedArtifact);

  return (
    <div className="flex flex-col h-full bg-[#0A0A0B] border border-gray-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#111113]">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-medium text-white">Interactive Preview</span>
          <span className="text-xs text-gray-500">({artifacts.length} artifacts)</span>
        </div>
        
        <div className="flex items-center gap-1 bg-[#1a1a1c] rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('split')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              viewMode === 'split' ? 'bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:text-white'
            }`}
          >
            Split
          </button>
          <button
            onClick={() => setViewMode('preview')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              viewMode === 'preview' ? 'bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:text-white'
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setViewMode('code')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              viewMode === 'code' ? 'bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:text-white'
            }`}
          >
            Code
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-56 border-r border-gray-800 bg-[#0f0f11] overflow-y-auto">
          <div className="p-2 space-y-1">
            {artifacts.map(artifact => (
              <button
                key={artifact.id}
                onClick={() => setSelectedArtifact(artifact.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                  selectedArtifact === artifact.id
                    ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span className={`p-1 rounded ${getTypeColor(artifact.type)}`}>
                  {getTypeIcon(artifact.type)}
                </span>
                <span className="text-sm truncate flex-1">{artifact.title}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <AnimatePresence mode="wait">
            {activeArtifact && (
              <motion.div
                key={activeArtifact.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex min-h-0"
              >
                {(viewMode === 'split' || viewMode === 'code') && (
                  <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} border-r border-gray-800 overflow-auto`}>
                    <div className="p-3 bg-[#1a1a1c] border-b border-gray-800">
                      <div className="flex items-center gap-2">
                        <Code className="w-4 h-4 text-gray-500" />
                        <span className="text-xs text-gray-400">Source</span>
                      </div>
                    </div>
                    <pre className="p-4 text-sm text-gray-300 font-mono whitespace-pre-wrap">
                      {activeArtifact.content}
                    </pre>
                  </div>
                )}

                {(viewMode === 'split' || viewMode === 'preview') && (
                  <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} flex flex-col`}>
                    <div className="p-3 bg-[#1a1a1c] border-b border-gray-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-gray-500" />
                          <span className="text-xs text-gray-400">Live Preview</span>
                        </div>
                        <button className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-white">
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 p-4 bg-white">
                      {activeArtifact.type === 'ui' && (
                        <div className="text-center text-gray-900">
                          <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg">
                            <span className="text-gray-500">UI Preview: {activeArtifact.title}</span>
                          </div>
                        </div>
                      )}
                      {activeArtifact.type === 'diagram' && (
                        <div className="text-center text-gray-900 p-4">
                          <div className="inline-block p-4 bg-gray-50 rounded-lg">
                            <span className="text-gray-500">Mermaid Diagram</span>
                          </div>
                        </div>
                      )}
                      {(activeArtifact.type === 'code' || activeArtifact.type === 'json') && (
                        <div className="text-center text-gray-900 p-4">
                          <div className="inline-block p-4 bg-gray-50 rounded-lg">
                            <span className="text-gray-500">Code Preview</span>
                          </div>
                        </div>
                      )}
                      {activeArtifact.type === 'markdown' && (
                        <div className="prose prose-sm max-w-none">
                          <h1>{activeArtifact.title}</h1>
                          <p>Preview content would render here...</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800 bg-[#111113]">
        <div className="text-xs text-gray-500">
          Last updated: {activeArtifact ? new Date(activeArtifact.timestamp).toLocaleTimeString() : 'N/A'}
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
            <RefreshCw className="w-3 h-3" />
            Regenerate
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors">
            <X className="w-3 h-3" />
            Dismiss
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-500 hover:bg-emerald-400 text-white rounded transition-colors">
            <ExternalLink className="w-3 h-3" />
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
