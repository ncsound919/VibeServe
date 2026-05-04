import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { useGuardrailsStore } from '../../src/services/guardrailsService';

describe('Guardrails Service — Policy-Driven Execution Protection', () => {
  beforeEach(() => {
    useGuardrailsStore.setState({
      policies: [
        {
          id: 'block-rm-rf',
          name: 'Block Destructive Commands',
          type: 'command',
          pattern: 'rm\\s+-rf\\s+/',
          effect: 'deny',
          enabled: true,
        },
        {
          id: 'block-env-secrets',
          name: 'Protect Environment Secrets',
          type: 'file_read',
          pattern: '\\.env(\\..*)?$',
          effect: 'deny',
          enabled: true,
        },
        {
          id: 'block-ssh-keys',
          name: 'Protect SSH Keys',
          type: 'file_read',
          pattern: '\\.ssh/.*',
          effect: 'deny',
          enabled: true,
        },
        {
          id: 'block-destructive-git',
          name: 'Block Git Reset Hard',
          type: 'command',
          pattern: 'git\\s+reset\\s+--hard',
          effect: 'deny',
          enabled: true,
        },
      ],
    });
  });

  it('allows safe commands', () => {
    const { validateAction } = useGuardrailsStore.getState();
    const result = validateAction('command', 'npm run build');
    assert.strictEqual(result.allowed, true);
  });

  it('blocks rm -rf /', () => {
    const { validateAction } = useGuardrailsStore.getState();
    const result = validateAction('command', 'rm -rf /');
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason?.includes('Block Destructive Commands'));
  });

  it('blocks git reset --hard', () => {
    const { validateAction } = useGuardrailsStore.getState();
    const result = validateAction('command', 'git reset --hard HEAD~1');
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason?.includes('Block Git Reset Hard'));
  });

  it('blocks reading .env files', () => {
    const { validateAction } = useGuardrailsStore.getState();
    const result = validateAction('file_read', '.env');
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason?.includes('Protect Environment Secrets'));
  });

  it('blocks reading .env.local variant', () => {
    const { validateAction } = useGuardrailsStore.getState();
    const result = validateAction('file_read', '.env.local');
    assert.strictEqual(result.allowed, false);
  });

  it('blocks reading files in .ssh directory', () => {
    const { validateAction } = useGuardrailsStore.getState();
    const result = validateAction('file_read', '.ssh/id_rsa');
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason?.includes('Protect SSH Keys'));
  });

  it('allows reading non-sensitive files', () => {
    const { validateAction } = useGuardrailsStore.getState();
    const result = validateAction('file_read', 'src/index.ts');
    assert.strictEqual(result.allowed, true);
  });

  it('allows network actions', () => {
    const { validateAction } = useGuardrailsStore.getState();
    const result = validateAction('network', 'https://api.github.com');
    assert.strictEqual(result.allowed, true);
  });

  it('respects disabled policies', () => {
    const store = useGuardrailsStore.getState();

    store.addPolicy({
      name: 'Test Policy',
      type: 'command',
      pattern: 'echo',
      effect: 'deny',
      enabled: false,
    });

    const result = useGuardrailsStore.getState().validateAction('command', 'echo test');
    assert.strictEqual(result.allowed, true);
  });

  it('allows all actions when no matching policies', () => {
    useGuardrailsStore.setState({ policies: [] });
    const { validateAction } = useGuardrailsStore.getState();
    assert.strictEqual(validateAction('command', 'rm -rf /').allowed, true);
    assert.strictEqual(validateAction('file_read', '.env').allowed, true);
    assert.strictEqual(validateAction('file_write', 'anything').allowed, true);
  });

  it('can add new deny policies dynamically', () => {
    const { addPolicy, validateAction } = useGuardrailsStore.getState();

    addPolicy({
      name: 'Block npm publish',
      type: 'command',
      pattern: 'npm\\s+publish',
      effect: 'deny',
      enabled: true,
    });

    const result = validateAction('command', 'npm publish');
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason?.includes('Block npm publish'));
  });

  it('case-insensitive matching for deny policies', () => {
    const { validateAction } = useGuardrailsStore.getState();
    const result = validateAction('command', 'Git Reset --HARD origin/main');
    assert.strictEqual(result.allowed, false);
  });
});
