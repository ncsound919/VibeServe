import type { ExtensionManifest, ExtensionContext } from './types';

// Git Hook Extension - Sample implementation
export const gitHookExtension: ExtensionManifest = {
  name: 'sample-git-hook',
  version: '1.0.0',
  description: 'Sample extension demonstrating git hooks integration with auto-format and lint on save',
  author: 'Nexus',
  tags: ['git', 'hooks', 'sample', 'automation'],
  hooks: [
    { event: 'onFileSave', handler: 'handleFileSave' },
    { event: 'onCommandExecute', handler: 'handleCommand' },
    { event: 'onGitCommit', handler: 'preCommitCheck' },
  ],
  permissions: ['file:read', 'file:write', 'command:execute', 'git:access'],
};

// Handler implementations
export function handleFileSave(context: ExtensionContext, filePath: string, content: string) {
  context.emitEvent('git-hook:save-start', { filePath });
  
  const ext = filePath.split('.').pop()?.toLowerCase();
  const isCodeFile = ['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs'].includes(ext || '');
  
  if (!isCodeFile) {
    context.emitEvent('git-hook:save-complete', { filePath, skipped: true });
    return { skipped: true, reason: 'Not a code file' };
  }
  
  // Simulate auto-format (in real implementation, call prettier/black/etc.)
  const formatted = content; // Placeholder for formatting
  context.setState('lastSaved', { filePath, timestamp: Date.now() });
  context.emitEvent('git-hook:formatted', { filePath, formatted: true });
  
  return { success: true, formatted: true };
}

export function handleCommand(context: ExtensionContext, command: string, args: string[]) {
  if (command !== 'git') return { ignored: true };
  
  const subcommand = args[0];
  context.emitEvent('git-hook:command', { command, args });
  
  if (subcommand === 'commit') {
    return preCommitCheck(context, args);
  }
  
  return { handled: true, subcommand };
}

export function preCommitCheck(context: ExtensionContext, args: string[]) {
  context.emitEvent('git-hook:pre-commit', { timestamp: Date.now() });
  
  // Check for common issues
  const checks = [
    { name: 'No console.log', passed: true },
    { name: 'No debugger statements', passed: true },
    { name: 'No TODO comments', passed: true },
  ];
  
  const allPassed = checks.every(c => c.passed);
  
  if (allPassed) {
    context.emitEvent('git-hook:commit-allowed', { checks });
    return { allowed: true, checks };
  } else {
    context.emitEvent('git-hook:commit-blocked', { checks });
    return { allowed: false, checks, message: 'Pre-commit checks failed' };
  }
}

// Export for extension host to load
export default {
  manifest: gitHookExtension,
  handlers: {
    handleFileSave,
    handleCommand,
    preCommitCheck,
  },
};
