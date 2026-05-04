import { useState } from 'react';
import { Download, Star, ChevronDown, Check, Shield, ShieldAlert, Loader2 } from 'lucide-react';
import { useExtensionHost } from '../../extensions/ExtensionHost';
import { ExtensionSecurityScanner } from '../../extensions/securityScanner';

interface MarketplaceExtension {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  stars: number;
  downloads: number;
  tags: string[];
  installed: boolean;
  scanStatus?: 'idle' | 'scanning' | 'safe' | 'unsafe';
  scanWarnings?: string[];
}

const SAMPLE_EXTENSIONS: MarketplaceExtension[] = [
  {
    id: 'sql-d1',
    name: 'D1 Database Connector',
    version: '1.0.0',
    description: 'Connect to Cloudflare D1 database',
    author: 'Nexus',
    stars: 42,
    downloads: 1200,
    tags: ['sql', 'database', 'cloudflare'],
    installed: false,
  },
  {
    id: 'sql-postgres',
    name: 'PostgreSQL Connector',
    version: '1.0.0',
    description: 'Connect to PostgreSQL via Supabase',
    author: 'Nexus',
    stars: 38,
    downloads: 980,
    tags: ['sql', 'database', 'postgres'],
    installed: false,
  },
  {
    id: 'sql-libsql',
    name: 'libSQL/Turso Connector',
    version: '1.0.0',
    description: 'Edge database connector for Turso',
    author: 'Nexus',
    stars: 25,
    downloads: 540,
    tags: ['sql', 'database', 'turso', 'edge'],
    installed: false,
  },
  {
    id: 'sql-duckdb',
    name: 'DuckDB Analytics',
    version: '1.0.0',
    description: 'OLAP analytics with DuckDB-WASM',
    author: 'Nexus',
    stars: 31,
    downloads: 720,
    tags: ['sql', 'analytics', 'olap'],
    installed: false,
  },
  {
    id: 'api-weather',
    name: 'Weather API',
    version: '1.0.0',
    description: 'Get weather data from OpenWeatherMap',
    author: 'Nexus',
    stars: 56,
    downloads: 2100,
    tags: ['api', 'weather', 'external'],
    installed: false,
  },
  {
    id: 'api-news',
    name: 'News API',
    version: '1.0.0',
    description: 'Fetch news from NewsAPI or Hacker News',
    author: 'Nexus',
    stars: 44,
    downloads: 1500,
    tags: ['api', 'news', 'external'],
    installed: false,
  },
  {
    id: 'git-hook',
    name: 'Git Hook Sample',
    version: '1.0.0',
    description: 'Sample git hooks extension',
    author: 'Nexus',
    stars: 18,
    downloads: 430,
    tags: ['git', 'hooks', 'sample'],
    installed: false,
  },
];

export function MarketplacePanel() {
  const [extensions, setExtensions] = useState(SAMPLE_EXTENSIONS);
  const [filter, setFilter] = useState('all');
  const extensionHost = useExtensionHost();

  const filtered = filter === 'all' 
    ? extensions 
    : extensions.filter(e => e.tags.includes(filter));

  const handleInstall = async (id: string) => {
    // 1. Simulate Security Scan
    setExtensions(prev => prev.map(e => e.id === id ? { ...e, scanStatus: 'scanning' } : e));
    
    // Simulate network delay for downloading code
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Scan extension (mocking the code for now)
    const mockCode = `
      // Some safe extension code
      function init() {
        console.log("Extension initialized");
      }
    `;
    const manifest = { name: id, version: '1.0.0', permissions: [] };
    const scanResult = ExtensionSecurityScanner.scan(mockCode, manifest);
    
    if (!scanResult.isSafe) {
      setExtensions(prev => prev.map(e => e.id === id ? { ...e, scanStatus: 'unsafe', scanWarnings: scanResult.errors } : e));
      return;
    }
    
    setExtensions(prev => prev.map(e => e.id === id ? { ...e, scanStatus: 'safe', scanWarnings: scanResult.warnings } : e));
    
    // 2. Install after 500ms
    setTimeout(() => {
      setExtensions(prev => 
        prev.map(e => e.id === id ? { ...e, installed: true } : e)
      );
      
      console.log(`[Marketplace] Installing ${id}`);
      extensionHost.loadExtension({
        name: id,
        version: '1.0.0',
        description: extensions.find(e => e.id === id)?.description || '',
        author: 'Nexus',
        tags: [],
        hooks: [],
        permissions: [],
      });
    }, 500);
  };

  const tags = ['all', 'sql', 'api', 'git', 'database'];

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] text-gray-300">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-2">Extension Marketplace</h2>
        <div className="flex gap-2">
          {tags.map(tag => (
            <button
              key={tag}
              onClick={() => setFilter(tag)}
              className={`px-3 py-1 text-xs rounded-full ${
                filter === tag 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filtered.map(ext => (
          <div key={ext.id} className="bg-[#252526] rounded-lg p-4 hover:bg-[#2a2a2a] transition-colors">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-white font-medium">{ext.name}</h3>
                <p className="text-xs text-gray-500">v{ext.version} • {ext.author}</p>
              </div>
              <button
                onClick={() => handleInstall(ext.id)}
                disabled={ext.installed || ext.scanStatus === 'scanning'}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded transition-colors ${
                  ext.installed
                    ? 'bg-gray-700 text-gray-400 cursor-default'
                    : ext.scanStatus === 'scanning'
                    ? 'bg-blue-600 text-white cursor-wait'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {ext.installed ? (
                  <>
                    <Check className="w-3 h-3" />
                    Installed
                  </>
                ) : ext.scanStatus === 'scanning' ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Download className="w-3 h-3" />
                    Install
                  </>
                )}
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-2">{ext.description}</p>
            {ext.scanStatus === 'safe' && (
               <div className="flex items-center gap-1 text-xs text-emerald-400 mb-2 bg-emerald-400/10 px-2 py-1 rounded w-fit">
                 <Shield className="w-3 h-3" />
                 Security Scan Passed
               </div>
            )}
            {ext.scanStatus === 'unsafe' && (
               <div className="flex flex-col gap-1 text-xs text-red-400 mb-2 bg-red-400/10 px-2 py-1 rounded">
                 <div className="flex items-center gap-1 font-semibold">
                   <ShieldAlert className="w-3 h-3" />
                   Security Scan Failed
                 </div>
                 <ul className="list-disc list-inside">
                   {ext.scanWarnings?.map((w, i) => <li key={i}>{w}</li>)}
                 </ul>
               </div>
            )}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3" />
                {ext.stars}
              </span>
              <span>{ext.downloads.toLocaleString()} downloads</span>
              <div className="flex gap-1">
                {ext.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-gray-700 rounded text-xs">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
