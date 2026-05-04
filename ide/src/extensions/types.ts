export interface ExtensionManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  tags?: string[];
  hooks: ExtensionHook[];
  permissions: string[];
}

export interface ExtensionHook {
  event: string;
  handler: string;
}

export interface Extension {
  manifest: ExtensionManifest;
  enabled: boolean;
  loadedAt?: number;
}

export interface ExtensionContext {
  getState: (key: string) => unknown;
  setState: (key: string, value: unknown) => void;
  emitEvent: (event: string, data?: unknown) => void;
  onEvent: (event: string, handler: (data: unknown) => void) => void;
}

export const SAMPLE_EXTENSION: ExtensionManifest = {
  name: 'sample-git-hook',
  version: '1.0.0',
  description: 'Sample extension demonstrating git hooks integration',
  author: 'Nexus',
  tags: ['git', 'hooks', 'sample'],
  hooks: [
    { event: 'onFileSave', handler: 'handleFileSave' },
    { event: 'onCommandExecute', handler: 'handleCommand' },
  ],
  permissions: ['file:read', 'file:write', 'command:execute'],
};
