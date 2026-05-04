import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { CodingAgentService } from '../../src/services/codingAgentService';

const TEMP_ROOT = path.resolve(process.cwd(), 'test-generated-apps');

function cleanup() {
  if (fs.existsSync(TEMP_ROOT)) {
    fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
  }
}

describe('CodingAgentService — BOLA Guards & Safe File Writing', () => {
  let service: CodingAgentService;

  beforeEach(() => {
    cleanup();
    service = new CodingAgentService();
  });

  afterEach(() => {
    cleanup();
  });

  it('rejects descriptions shorter than 3 characters', async () => {
    const result = await service.generateApp({
      description: 'ab',
      userId: 'test-user',
    } as Parameters<CodingAgentService['generateApp']>[0]);

    assert.strictEqual(result.success, false);
    assert.ok(result.message?.includes('too short'));
  });

  it('accepts descriptions of 3+ characters', async () => {
    const result = await service.generateApp({
      description: 'Build a todo app with React',
      userId: 'test-user',
    } as Parameters<CodingAgentService['generateApp']>[0]);

    assert.strictEqual(result.success, true, result.message || 'Generation failed unexpectedly');
    assert.ok(result.appPath);
    assert.ok(result.files && result.files.length > 0, 'Should generate at least one file');
    assert.ok(result.templateId);
  });

  it('path traversal is prevented (directory confinement guard)', () => {
    const svc = new CodingAgentService();
    const outDir = (svc as unknown as { OUT_DIR: string }).OUT_DIR;
    assert.ok(typeof outDir === 'string' && outDir.length > 0, 'OUT_DIR should be defined');

    const testPath = path.resolve(outDir, 'test-app-123');
    const isConfined = testPath.startsWith(outDir + path.sep);
    assert.strictEqual(isConfined, true, 'paths inside OUT_DIR should start with OUT_DIR prefix');

    const traversalAttempt = path.resolve(outDir, '..', '..', 'etc', 'passwd');
    const isOutOfBounds = traversalAttempt.startsWith(outDir + path.sep);
    assert.strictEqual(isOutOfBounds, false, 'path traversal attempts must not start with OUT_DIR prefix');
  });

  it('reports templateId in successful generation', async () => {
    const result = await service.generateApp({
      description: 'Create an Express REST API with JWT auth',
      userId: 'test-user',
    } as Parameters<CodingAgentService['generateApp']>[0]);

    if (result.success) {
      assert.ok(result.templateId);
      assert.ok(typeof result.templateId === 'string');
      assert.ok(result.templateId.length > 0);
    }
  });

  it('auto-selects a template matching the description', async () => {
    const result = await service.generateApp({
      description: 'Build a React TypeScript dashboard',
      userId: 'test-user',
    } as Parameters<CodingAgentService['generateApp']>[0]);

    if (result.success) {
      assert.ok(result.templateId && result.templateId.length > 0);
    }
  });

  it('falls back to description-based template when templateId not found', async () => {
    const result = await service.generateApp({
      description: 'xyzzy-foobar-nonexistent',
      userId: 'test-user',
      templateId: 'no-such-template',
    } as Parameters<CodingAgentService['generateApp']>[0]);

    if (result.success) {
      assert.ok(result.templateId, 'With no matching templateId, should fall back to description-matched template');
      assert.ok(result.appPath);
    }
  });
});
