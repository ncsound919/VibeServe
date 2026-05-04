import { ExtensionManifest } from "../extensions/types";

export interface MarketplaceExtension extends ExtensionManifest {
  stars: number;
  downloads: number;
  author: string;
}

// In-memory mock database for the marketplace backend
const extensionsDB: MarketplaceExtension[] = [
  {
    name: 'sql-d1',
    version: '1.0.0',
    description: 'Connect to Cloudflare D1 database',
    author: 'Nexus',
    stars: 42,
    downloads: 1200,
    tags: ['sql', 'database', 'cloudflare'],
    hooks: [],
    permissions: []
  },
  {
    name: 'sql-postgres',
    version: '1.0.0',
    description: 'Connect to PostgreSQL via Supabase',
    author: 'Nexus',
    stars: 38,
    downloads: 980,
    tags: ['sql', 'database', 'postgres'],
    hooks: [],
    permissions: []
  },
  {
    name: 'sql-libsql',
    version: '1.0.0',
    description: 'Edge database connector for Turso',
    author: 'Nexus',
    stars: 25,
    downloads: 540,
    tags: ['sql', 'database', 'turso', 'edge'],
    hooks: [],
    permissions: []
  },
  {
    name: 'sql-duckdb',
    version: '1.0.0',
    description: 'OLAP analytics with DuckDB-WASM',
    author: 'Nexus',
    stars: 31,
    downloads: 720,
    tags: ['sql', 'analytics', 'olap'],
    hooks: [],
    permissions: []
  },
  {
    name: 'api-weather',
    version: '1.0.0',
    description: 'Get weather data from OpenWeatherMap',
    author: 'Nexus',
    stars: 56,
    downloads: 2100,
    tags: ['api', 'weather', 'external'],
    hooks: [],
    permissions: []
  },
  {
    name: 'api-news',
    version: '1.0.0',
    description: 'Fetch news from NewsAPI or Hacker News',
    author: 'Nexus',
    stars: 44,
    downloads: 1500,
    tags: ['api', 'news', 'external'],
    hooks: [],
    permissions: []
  },
  {
    name: 'git-hook',
    version: '1.0.0',
    description: 'Sample git hooks extension',
    author: 'Nexus',
    stars: 18,
    downloads: 430,
    tags: ['git', 'hooks', 'sample'],
    hooks: [],
    permissions: []
  }
];

export function getMarketplaceExtensions(): MarketplaceExtension[] {
  return extensionsDB;
}

export function searchMarketplace(query: string): MarketplaceExtension[] {
  const q = query.toLowerCase();
  return extensionsDB.filter(ext => 
    ext.name.toLowerCase().includes(q) || 
    ext.description.toLowerCase().includes(q) || 
    (ext.tags && ext.tags.some(t => t.toLowerCase().includes(q)))
  );
}

export function incrementDownloads(name: string): boolean {
  const ext = extensionsDB.find(e => e.name === name);
  if (ext) {
    ext.downloads += 1;
    return true;
  }
  return false;
}
