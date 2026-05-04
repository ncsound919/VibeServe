import fs from 'fs/promises';
import path from 'path';

const AUDIT_DIR = path.resolve(process.cwd(), 'user-data/audit-logs');

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  metadata: any;
  status: 'success' | 'failure' | 'warning';
}

export async function initAuditService() {
  await fs.mkdir(AUDIT_DIR, { recursive: true });
}

export async function logAuditEvent(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<AuditEntry> {
  const fullEntry: AuditEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry
  };

  try {
    const filename = `${new Date().toISOString().split('T')[0]}.jsonl`;
    const filePath = path.join(AUDIT_DIR, filename);
    await fs.appendFile(filePath, JSON.stringify(fullEntry) + '\n');
  } catch (err) {
    console.error(`[AuditLog] Failed to write audit event (${entry.action}): ${err instanceof Error ? err.message : String(err)}`);
  }
  return fullEntry;
}

export async function getAuditLogs(date?: string): Promise<AuditEntry[]> {
  const filename = date ? `${date}.jsonl` : `${new Date().toISOString().split('T')[0]}.jsonl`;
  const filePath = path.join(AUDIT_DIR, filename);
  
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.split('\n').filter(Boolean).map(line => JSON.parse(line));
  } catch {
    return [];
  }
}
