import { useState } from 'react';
import { Figma, ExternalLink, Copy, Check, PenTool, LayoutTemplate } from 'lucide-react';

export function FigmaPanel() {
  const [activeTab, setActiveTab] = useState<'figma' | 'penpot' | 'framer'>('figma');
  const [designUrl, setDesignUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const mcpConfigs = {
    figma: `{
  "inputs": [],
  "servers": {
    "figma": {
      "url": "https://mcp.figma.com/mcp",
      "type": "http"
    }
  }
}`,
    penpot: `{
  "inputs": [],
  "servers": {
    "penpot": {
      "url": "https://mcp.penpot.app/mcp",
      "type": "http"
    }
  }
}`,
    framer: `{
  "inputs": [],
  "servers": {
    "framer": {
      "url": "https://mcp.framer.com/mcp",
      "type": "http"
    }
  }
}`
  };

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(mcpConfigs[activeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenDesign = () => {
    if (designUrl) {
      window.open(designUrl, '_blank');
    } else {
      const urls = {
        figma: 'https://www.figma.com',
        penpot: 'https://design.penpot.app',
        framer: 'https://www.framer.com'
      };
      window.open(urls[activeTab], '_blank');
    }
  };

  const currentIcon = () => {
    if (activeTab === 'figma') return <Figma className="w-8 h-8 text-purple-400" />;
    if (activeTab === 'penpot') return <PenTool className="w-8 h-8 text-emerald-400" />;
    return <LayoutTemplate className="w-8 h-8 text-blue-400" />;
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] text-gray-300 p-6">
      <div className="max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-6">
          {currentIcon()}
          <div>
            <h2 className="text-xl font-semibold text-white">Design Tools Integration</h2>
            <p className="text-sm text-gray-400">Connect to design tools via Model Context Protocol</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-700 pb-2">
          <button 
            onClick={() => setActiveTab('figma')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'figma' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-400 hover:text-gray-200'}`}
          >
            Figma
          </button>
          <button 
            onClick={() => setActiveTab('penpot')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'penpot' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-gray-400 hover:text-gray-200'}`}
          >
            Penpot
          </button>
          <button 
            onClick={() => setActiveTab('framer')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'framer' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
          >
            Framer
          </button>
        </div>

        <div className="space-y-6">
          {/* MCP Config */}
          <div className="bg-[#252526] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-medium capitalize">{activeTab} MCP Configuration</h3>
              <button
                onClick={handleCopyConfig}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy Config'}
              </button>
            </div>
            <pre className="bg-[#1e1e1e] p-3 rounded text-xs text-gray-300 overflow-x-auto border border-gray-800">
              {mcpConfigs[activeTab]}
            </pre>
          </div>

          {/* Setup Instructions */}
          <div className="bg-[#252526] rounded-lg p-4">
            <h3 className="text-white font-medium mb-3">Setup Instructions</h3>
            <ol className="space-y-2 text-sm text-gray-300 list-decimal list-inside">
              <li>Copy the {activeTab} MCP configuration above</li>
              <li>Add it to your MCP client (Nexus, Cursor, VS Code)</li>
              <li>Restart your MCP client to load the server</li>
              <li>Authenticate via OAuth when prompted</li>
              <li>Start using {activeTab} tools in your AI workflow</li>
            </ol>
          </div>

          {/* URL Input */}
          <div className="bg-[#252526] rounded-lg p-4">
            <h3 className="text-white font-medium mb-3">Get Design Context</h3>
            <p className="text-sm text-gray-400 mb-3">
              Paste a {activeTab} design URL to get context for implementation
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={designUrl}
                onChange={(e) => setDesignUrl(e.target.value)}
                placeholder={`https://www.${activeTab}.com/...`}
                className="flex-1 px-3 py-2 bg-[#1e1e1e] border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
              <button
                onClick={handleOpenDesign}
                className={`flex items-center gap-1 px-4 py-2 text-white rounded text-sm transition-colors ${activeTab === 'figma' ? 'bg-purple-600 hover:bg-purple-700' : activeTab === 'penpot' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                <ExternalLink className="w-4 h-4" />
                Open
              </button>
            </div>
          </div>

          {/* Available Tools */}
          <div className="bg-[#252526] rounded-lg p-4">
            <h3 className="text-white font-medium mb-3">Available {activeTab} MCP Tools</h3>
            <div className="space-y-2 text-sm">
              <div className="p-2 bg-[#1e1e1e] rounded border border-gray-800">
                <code className={`${activeTab === 'figma' ? 'text-purple-400' : activeTab === 'penpot' ? 'text-emerald-400' : 'text-blue-400'}`}>get_design_context</code>
                <p className="text-gray-400 mt-1">Get design context from a {activeTab} URL or node ID</p>
              </div>
              <div className="p-2 bg-[#1e1e1e] rounded border border-gray-800">
                <code className={`${activeTab === 'figma' ? 'text-purple-400' : activeTab === 'penpot' ? 'text-emerald-400' : 'text-blue-400'}`}>create_{activeTab}_content</code>
                <p className="text-gray-400 mt-1">Create or modify {activeTab} content programmatically</p>
              </div>
              {activeTab === 'figma' && (
                <div className="p-2 bg-[#1e1e1e] rounded border border-gray-800">
                  <code className="text-purple-400">capture_ui</code>
                  <p className="text-gray-400 mt-1">Capture live UI from your web app to Figma</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
