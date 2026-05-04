# Nexus Alpha Extension API Documentation

## Overview
Nexus Alpha supports extensions to extend functionality through a manifest-based system. Extensions declare hooks, permissions, and metadata.

## Extension Manifest Schema

```typescript
interface ExtensionManifest {
  name: string;              // Unique extension identifier
  version: string;            // SemVer version
  description: string;        // Human-readable description
  author: string;             // Extension author
  tags?: string[];            // Optional categorization tags
  hooks: ExtensionHook[];    // Event hooks to register
  permissions: string[];     // Required permissions
}

interface ExtensionHook {
  event: string;              // Event name (e.g., 'onFileSave')
  handler: string;            // Handler function name
}
```

## Available Events

| Event | Description | Data |
|-------|-------------|------|
| `onFileSave` | Triggered when a file is saved | `{ filePath, content }` |
| `onCommandExecute` | Triggered on command execution | `{ command, args }` |
| `onGitCommit` | Triggered during git commit | `{ message, files }` |
| `onAppStart` | Triggered when app initializes | `{}` |
| `onCommand` | Custom command handler | `{ command, params }` |

## Permissions

- `file:read` - Read file system access
- `file:write` - Write file system access
- `command:execute` - Execute shell commands
- `network:access` - Make network requests
- `git:access` - Access git repositories
- `agent:interact` - Interact with AI agents

## Creating an Extension

### 1. Define Manifest
```typescript
const myExtension = {
  name: 'my-extension',
  version: '1.0.0',
  description: 'My custom extension',
  author: 'Your Name',
  tags: ['custom', 'automation'],
  hooks: [
    { event: 'onFileSave', handler: 'handleSave' },
  ],
  permissions: ['file:read'],
};
```

### 2. Implement Handlers
```typescript
export function handleSave(context: ExtensionContext, filePath: string, content: string) {
  context.emitEvent('my-ext:save', { filePath });
  return { success: true };
}
```

### 3. Load Extension
Extensions are loaded via the ExtensionHost store:
```typescript
import { useExtensionHost } from './ExtensionHost';
const host = useExtensionHost.getState();
host.loadExtension(myManifest);
```

## Sample Extensions

### SQL Connectors
- **sql-d1**: Cloudflare D1 database connector
- **sql-postgres**: PostgreSQL connector via Supabase
- **sql-libsql**: Turso/libSQL edge database connector
- **sql-duckdb**: DuckDB analytics connector

### API Connectors
- **api-weather**: OpenWeatherMap/wttr.in integration
- **api-news**: NewsAPI.org/Hacker News integration

### Git Hook Sample
- **sample-git-hook**: Auto-format and pre-commit checks

## Extension Context API

```typescript
interface ExtensionContext {
  getState: (key: string) => unknown;
  setState: (key: string, value: unknown) => void;
  emitEvent: (event: string, data?: unknown) => void;
  onEvent: (event: string, handler: (data: unknown) => void) => void;
}
```

## Security

Extensions run with declared permissions only. The ExtensionHost validates permissions before executing hooks. Extensions cannot access undeclared permissions.

## Future: Marketplace

A marketplace for extensions is planned for Phase 4 Differentiation. Extensions will be:
- Scanned for security vulnerabilities
- Rated by users
- Searchable by tags and functionality
