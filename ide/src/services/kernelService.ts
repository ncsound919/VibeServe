/**
 * Nexus Kernel — The "LLM OS" Core
 * 
 * Inspired by Andrej Karpathy's vision. The Kernel treats the LLM as the CPU,
 * managing "RAM" (active context window) and "System Calls" (tool executions).
 */

import { logger } from '../lib/logger';

export interface KernelProcess {
  pid: string;
  name: string;
  status: 'running' | 'waiting' | 'zombie' | 'terminated';
  memoryUsage: number; // Estimated tokens in context
  startTime: number;
}

export class KernelService {
  private processes: Map<string, KernelProcess> = new Map();
  private ram: string[] = []; // Simple FIFO context stack
  private readonly MAX_RAM_TOKENS = 32000;

  constructor() {
    logger.info('NexusKernel', 'Kernel initialized. Managing context RAM and tool interrupts.');
  }

  /**
   * Spawns a new reasoning process.
   */
  spawnProcess(name: string): string {
    const pid = `p_${Math.random().toString(36).slice(2, 9)}`;
    this.processes.set(pid, {
      pid,
      name,
      status: 'running',
      memoryUsage: 0,
      startTime: Date.now()
    });
    logger.info('NexusKernel', `Spawned process ${name} (PID: ${pid})`);
    return pid;
  }

  /**
   * Injects data into "RAM" (Context Window).
   */
  allocateMemory(data: string): void {
    this.ram.push(data);
    // Simple FIFO cleanup if "RAM" is full
    if (this.ram.length > 50) {
      this.ram.shift();
    }
  }

  /**
   * Retrieves active "RAM" for prompt injection.
   */
  getRAMContext(): string {
    return this.ram.join('\n---\n');
  }

  /**
   * Standardized "System Call" for tool execution.
   */
  async systemCall(pid: string, tool: string, args: any): Promise<any> {
    const process = this.processes.get(pid);
    if (!process) throw new Error(`Invalid PID: ${pid}`);

    logger.info('NexusKernel', `[PID ${pid}] SYSCALL: ${tool}`);
    process.status = 'waiting';

    // In a full implementation, this would route to mcp.ts or brainToolService
    // For now, we simulate the interrupt handling
    try {
      // Simulate tool latency
      await new Promise(r => setTimeout(r, 500));
      process.status = 'running';
      return { status: 'success', data: `Simulated result for ${tool}` };
    } catch (err) {
      process.status = 'zombie';
      throw err;
    }
  }

  terminateProcess(pid: string): void {
    const process = this.processes.get(pid);
    if (process) {
      process.status = 'terminated';
      logger.info('NexusKernel', `Terminated process (PID: ${pid})`);
    }
  }

  getKernelStatus() {
    return {
      activeProcesses: [...this.processes.values()].filter(p => p.status !== 'terminated'),
      ramUsage: this.ram.length,
      uptime: process.uptime()
    };
  }
}

export const kernelService = new KernelService();
