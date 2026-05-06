/**
 * Native File-Backed Job Queue — replaces BullMQ + Redis.
 *
 * Single-process queue with JSON file persistence for crash recovery.
 * Supports:
 * - Job enqueuing with optional repeat schedules (cron patterns)
 * - Worker processing with concurrency
 * - Job status tracking (waiting, active, completed, failed)
 * - Event emitters (completed, failed, error)
 *
 * No external dependencies. Works on any platform.
 */

import { existsSync, mkdirSync, readFileSync } from 'fs';
import { writeFile } from 'fs/promises';
import { EventEmitter } from 'events';
import path from 'path';
import crypto from 'crypto';

const QUEUE_DIR = path.resolve(process.cwd(), '.vibeserve', 'queue');
const JOBS_FILE = path.join(QUEUE_DIR, 'jobs.json');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FileJobData {
  [key: string]: any;
}

export interface FileJob {
  id: string;
  name: string;
  data: FileJobData;
  opts: FileJobOpts;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress: number;
  returnvalue?: any;
  failedReason?: string;
  createdAt: number;
  processedAt?: number;
  finishedAt?: number;
  attempts: number;
  updateProgress(value: number): void;
}

export interface FileJobOpts {
  attempts?: number;
  backoff?: { type: string; delay: number };
  removeOnComplete?: number | boolean;
  removeOnFail?: number | boolean;
  repeat?: { pattern: string; every?: number };
}

interface ScheduledJob {
  name: string;
  pattern: string;
  nextRunAt: number;
  data: FileJobData;
  timer?: ReturnType<typeof setTimeout>;
}

// ─── Cron Parser (minimal — supports standard 5-field format) ─────────────────

function cronNextRun(pattern: string): number {
  const parts = pattern.trim().split(/\s+/);
  if (parts.length < 5) return Date.now() + 3600000; // default: 1 hour

  const [minute, hour, dayOfMonth, _month, _dayOfWeek] = parts;
  const now = new Date();
  let next = new Date(now);

  next.setSeconds(0);
  next.setMilliseconds(0);

  if (minute === '*') {
    next.setMinutes(next.getMinutes() + 1);
  } else if (minute !== '*') {
    next.setMinutes(parseInt(minute));

    if (hour !== '*') {
      next.setHours(parseInt(hour));
    }

    if (next <= now) {
      // Already past this minute/hour — advance
      if (hour === '*') {
        next.setHours(next.getHours() + 1);
      } else {
        next.setDate(next.getDate() + 1);
      }
    }
  }

  return next.getTime();
}

function _createJob(name: string, data: FileJobData, opts?: FileJobOpts): FileJob {
  const job: FileJob = {
    id: crypto.randomUUID(),
    name,
    data,
    opts: opts || {},
    status: 'waiting',
    progress: 0,
    createdAt: Date.now(),
    attempts: 0,
    updateProgress(value: number) { this.progress = value; },
  };
  return job;
}

// ─── File Queue ───────────────────────────────────────────────────────────────

export class FileQueue extends EventEmitter {
  private jobs: FileJob[] = [];
  private scheduled: ScheduledJob[] = [];
  private pollTimer?: ReturnType<typeof setInterval>;
  private _closed = false;
  private _firing: Set<string> = new Set();
  private _timers: Set<ReturnType<typeof setTimeout>> = new Set();

  constructor(public readonly name: string) {
    super();
    ensureDir();
    this._load();
    this._startPolling();
  }

  // ── Public API (mirrors bullmq Queue) ──────────────────────────────────────

  async add(jobName: string, data: FileJobData, opts?: FileJobOpts): Promise<FileJob> {
    const job = _createJob(jobName, data, opts);

    // Handle repeatable jobs
    if (opts?.repeat?.pattern) {
      const existing = this.scheduled.find(
        s => s.name === jobName && s.pattern === opts.repeat!.pattern
      );
      if (existing) {
        // Update data for existing schedule
        existing.data = data;
        return { ...job, id: existing.name };
      }

      const scheduled: ScheduledJob = {
        name: jobName,
        pattern: opts.repeat.pattern,
        nextRunAt: cronNextRun(opts.repeat.pattern),
        data,
      };
      this._scheduleJob(scheduled);
      this.scheduled.push(scheduled);
      await this._save();
      return { ...job, id: jobName };
    }

    this.jobs.push(job);
    this._trim();
    await this._save();
    return job;
  }

  async getJob(jobId: string): Promise<FileJob | null> {
    return this.jobs.find(j => j.id === jobId) || null;
  }

  async getJobCounts(): Promise<Record<string, number>> {
    const counts: Record<string, number> = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    for (const job of this.jobs) {
      counts[job.status] = (counts[job.status] || 0) + 1;
    }
    return counts;
  }

  async removeRepeatable(name: string, opts?: { pattern?: string }): Promise<void> {
    this.scheduled = this.scheduled.filter(
      s => !(s.name === name && (!opts?.pattern || s.pattern === opts.pattern))
    );
    await this._save();
  }

  async close(): Promise<void> {
    this._closed = true;
    if (this.pollTimer) clearInterval(this.pollTimer);
    for (const timer of this._timers) clearTimeout(timer);
    this._timers.clear();
    await this._save();
  }

  getJobs(): FileJob[] { return this.jobs; }

  async persist(): Promise<void> { await this._save(); }

  // ── Internal ───────────────────────────────────────────────────────────────

  private _load(): void {
    try {
      if (existsSync(JOBS_FILE)) {
        const data = JSON.parse(readFileSync(JOBS_FILE, 'utf-8'));
        this.jobs = data.jobs || [];
        this.scheduled = data.scheduled || [];
      }
    } catch { /* start fresh */ }
  }

  private async _save(): Promise<void> {
    ensureDir();
    try {
      await writeFile(JOBS_FILE, JSON.stringify({
        jobs: this.jobs.slice(-500),
        scheduled: this.scheduled,
      }, null, 2), 'utf-8');
    } catch {
      // Log but don't crash — queue continues in memory
    }
  }

  private _trim(): void {
    // Remove old completed/failed jobs if configured
    const maxComplete = 100;
    const completed = this.jobs.filter(j => j.status === 'completed');
    const failed = this.jobs.filter(j => j.status === 'failed');
    if (completed.length > maxComplete) {
      this.jobs = this.jobs.filter(j => j.status !== 'completed' || completed.indexOf(j) >= completed.length - maxComplete);
    }
    if (failed.length > 50) {
      this.jobs = this.jobs.filter(j => j.status !== 'failed' || failed.indexOf(j) >= failed.length - 50);
    }
    // Hard cap
    if (this.jobs.length > 500) {
      this.jobs = this.jobs.slice(this.jobs.length - 500);
    }
  }

  private _startPolling(): void {
    this.pollTimer = setInterval(() => {
      if (this._closed) return;

      const now = Date.now();
      for (const s of this.scheduled) {
        if (now >= s.nextRunAt && !this._firing.has(s.name)) {
          this._firing.add(s.name);
          const job = _createJob(s.name, s.data, { repeat: { pattern: s.pattern } });
          this.jobs.push(job);
          s.nextRunAt = cronNextRun(s.pattern);
          this._save();
          this.emit('job:ready', job);
          this._firing.delete(s.name);
        }
      }
    }, 15000);
  }

  private _scheduleJob(scheduled: ScheduledJob): void {
    const delay = Math.max(0, scheduled.nextRunAt - Date.now());
    scheduled.timer = setTimeout(() => {
      this._timers.delete(scheduled.timer!);
      const job = _createJob(scheduled.name, scheduled.data, { repeat: { pattern: scheduled.pattern } });
      this.jobs.push(job);
      scheduled.nextRunAt = cronNextRun(scheduled.pattern);
      this._scheduleJob(scheduled);
      this._save();
      this.emit('job:ready', job);
    }, delay);
    this._timers.add(scheduled.timer);
  }
}

// ─── File Worker ──────────────────────────────────────────────────────────────

export class FileWorker extends EventEmitter {
  private running = false;
  private activeCount = 0;
  private _pollInterval?: ReturnType<typeof setInterval>;
  private _checkInterval?: ReturnType<typeof setInterval>;

  constructor(
    public readonly queueName: string,
    private handler: (job: FileJob) => Promise<unknown>,
    private opts?: { connection?: unknown; concurrency?: number }
  ) {
    super();
  }

  async close(): Promise<void> {
    this.running = false;
    if (this._pollInterval) clearInterval(this._pollInterval);
    if (this._checkInterval) clearInterval(this._checkInterval);
  }

  // Called by the queue to start processing
  start(queue: FileQueue): void {
    if (this.running) return;
    this.running = true;

    queue.on('job:ready', async (job: FileJob) => {
      if (!this.running) return;
      const maxConcurrency = this.opts?.concurrency || 2;
      if (this.activeCount >= maxConcurrency) return;
      this._processJob(queue, job);
    });

    // Process existing waiting jobs
    this._processExisting(queue);
  }

  private async _processExisting(queue: FileQueue): Promise<void> {
    const processNext = async () => {
      if (!this.running) return;
      const maxConcurrency = this.opts?.concurrency || 2;
      if (this.activeCount >= maxConcurrency) return;

      const jobs = queue.getJobs();
      const next = jobs.find(j => j.status === 'waiting');
      if (!next) return;
      this._processJob(queue, next);
    };

    this._pollInterval = setInterval(processNext, 2000);
    processNext();

    this._checkInterval = setInterval(() => {
      if (!this.running) {
        if (this._pollInterval) clearInterval(this._pollInterval);
        if (this._checkInterval) clearInterval(this._checkInterval);
      }
    }, 5000);
  }

  private async _processJob(queue: FileQueue, job: FileJob): Promise<void> {
    this.activeCount++;
    job.status = 'active';
    job.processedAt = Date.now();
    await queue.persist();

    try {
      const result = await this.handler({
        id: job.id, name: job.name,
        data: job.data, opts: job.opts,
        progress: job.progress,
      } as any);
      job.status = 'completed';
      job.returnvalue = result;
      job.finishedAt = Date.now();
      await queue.persist();
      this.emit('completed', { id: job.id, data: job.data, returnvalue: result });
    } catch (err: any) {
      job.attempts++;
      const maxAttempts = job.opts?.attempts || 2;
      if (job.attempts < maxAttempts) {
        job.status = 'waiting';
        job.processedAt = undefined;
        const delay = (job.opts?.backoff?.delay || 5000) * Math.pow(2, job.attempts - 1);
        await new Promise(r => setTimeout(r, delay));
      } else {
        job.status = 'failed';
        job.failedReason = err.message;
        job.finishedAt = Date.now();
      }
      await queue.persist();
      this.emit('failed', { id: job.id, data: job.data }, err);
    } finally {
      this.activeCount--;
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let queueDirEnsured = false;
function ensureDir(): void {
  if (queueDirEnsured) return;
  if (!existsSync(QUEUE_DIR)) mkdirSync(QUEUE_DIR, { recursive: true });
  queueDirEnsured = true;
}
