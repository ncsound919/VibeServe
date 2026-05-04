import type { ExtensionManifest, ExtensionContext } from './types';

// D1 Database Connector (Cloudflare D1)
export const d1Connector: ExtensionManifest = {
  name: 'sql-d1',
  version: '1.0.0',
  description: 'Connect to Cloudflare D1 database with REST API',
  author: 'Nexus',
  tags: ['sql', 'database', 'cloudflare', 'd1'],
  hooks: [
    { event: 'onCommand', handler: 'executeQuery' },
    { event: 'onFileSave', handler: 'logQuery' },
  ],
  permissions: ['network:access', 'file:read'],
};

export function executeQuery(context: ExtensionContext, query: string, accountId?: string, databaseId?: string, apiToken?: string) {
  if (!query) return { error: 'Query required' };
  
  const d1ApiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
  
  return fetch(d1ApiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql: query }),
  })
    .then(res => res.json())
    .then(data => {
      context.emitEvent('query:complete', { query, result: data });
      return data;
    })
    .catch(err => {
      context.emitEvent('query:error', { query, error: err.message });
      return { error: err.message };
    });
}

// PostgreSQL Connector
export const postgresConnector: ExtensionManifest = {
  name: 'sql-postgres',
  version: '1.0.0',
  description: 'Connect to PostgreSQL database via pgwire protocol',
  author: 'Nexus',
  tags: ['sql', 'database', 'postgres', 'postgresql'],
  hooks: [
    { event: 'onCommand', handler: 'queryPostgres' },
    { event: 'onFileSave', handler: 'backupSchema' },
  ],
  permissions: ['network:access', 'file:read', 'file:write'],
};

export function queryPostgres(context: ExtensionContext, query: string, connectionString: string) {
  if (!query) return { error: 'Query required' };
  
  // Use Supabase client or direct pg connection
  const supabase = context.getState('supabaseClient');
  if (supabase) {
    return supabase.rpc('execute_sql', { query })
      .then(({ data, error }: any) => {
        if (error) {
          context.emitEvent('query:error', { query, error: error.message });
          return { error: error.message };
        }
        context.emitEvent('query:complete', { query, result: data });
        return data;
      });
  }
  
  return { error: 'No database client available' };
}

// libSQL Connector (Turso)
export const libsqlConnector: ExtensionManifest = {
  name: 'sql-libsql',
  version: '1.0.0',
  description: 'Connect to libSQL/Turso edge database',
  author: 'Nexus',
  tags: ['sql', 'database', 'libsql', 'turso', 'edge'],
  hooks: [
    { event: 'onCommand', handler: 'queryLibSQL' },
    { event: 'onAppStart', handler: 'initConnection' },
  ],
  permissions: ['network:access'],
};

export function queryLibSQL(context: ExtensionContext, query: string, url?: string, authToken?: string) {
  if (!query) return { error: 'Query required' };
  
  const dbUrl = url || context.getState('libsqlUrl');
  const token = authToken || context.getState('libsqlToken');
  
  if (!dbUrl) return { error: 'libSQL URL required' };
  
  return fetch(`${dbUrl}/v2/pipeline`, {
    method: 'POST',
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [{ type: 'execute', stmt: { sql: query } }, { type: 'close' }],
    }),
  })
    .then(res => res.json())
    .then(data => {
      context.emitEvent('query:complete', { query, result: data });
      return data;
    })
    .catch(err => {
      context.emitEvent('query:error', { query, error: err.message });
      return { error: err.message };
    });
}

// DuckDB Connector (Analytics)
export const duckdbConnector: ExtensionManifest = {
  name: 'sql-duckdb',
  version: '1.0.0',
  description: 'Connect to DuckDB for analytics and OLAP queries',
  author: 'Nexus',
  tags: ['sql', 'database', 'duckdb', 'analytics', 'olap'],
  hooks: [
    { event: 'onCommand', handler: 'queryDuckDB' },
    { event: 'onFileSave', handler: 'exportToParquet' },
  ],
  permissions: ['network:access', 'file:read', 'file:write'],
};

export function queryDuckDB(context: ExtensionContext, query: string, database?: string) {
  if (!query) return { error: 'Query required' };
  
  // DuckDB-WASM or server-side proxy
  const wasmUrl = 'https://cdn.jsdelivr.net/npm/duckdb-wasm@latest/dist/duckdb-browser-eh.wasm';
  
  context.emitEvent('query:start', { query, database });
  
  // Placeholder for DuckDB-WASM integration
  return { 
    message: 'DuckDB connector ready', 
    query,
    wasmUrl,
    note: 'Load DuckDB-WASM in browser for local analytics'
  };
}
