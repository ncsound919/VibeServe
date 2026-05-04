import fs from 'fs/promises';
import path from 'path';

const LOGS_DIR = path.resolve(process.cwd(), 'user-data/execution-logs');

export async function initLogService() {
  await fs.mkdir(LOGS_DIR, { recursive: true });
}

export async function saveExecutionLog(executionId: string, logs: string[]) {
  const filePath = path.join(LOGS_DIR, `${executionId}.json`);
  await fs.writeFile(filePath, JSON.stringify({ executionId, logs, timestamp: new Date().toISOString() }, null, 2));
}

export async function getExecutionLog(executionId: string) {
  const filePath = path.join(LOGS_DIR, `${executionId}.json`);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function listExecutionLogs() {
  try {
    const files = await fs.readdir(LOGS_DIR);
    return files.map(f => f.replace('.json', ''));
  } catch {
    return [];
  }
}
