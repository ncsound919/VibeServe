import { McpClient } from "./mcp-client.js";

export interface LifecycleOptions {
  pythonPath?: string;
  cwd?: string;
  timeoutMs?: number;
  autoRestart?: boolean;
  maxRestarts?: number;
  onExit?: (code: number) => never;
}

export class Lifecycle {
  public mcp: McpClient;
  private autoRestart: boolean;
  private maxRestarts: number;
  private restartCount = 0;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private shutdownInProgress = false;
  private options: LifecycleOptions;
  private processExit: (code: number) => never;
  private _sigintHandler: () => void;
  private _sigtermHandler: () => void;

  constructor(options?: LifecycleOptions) {
    this.options = options ?? {};
    this.autoRestart = this.options.autoRestart ?? true;
    this.maxRestarts = this.options.maxRestarts ?? 5;
    this.processExit = this.options.onExit ?? ((code: number) => process.exit(code));
    this.mcp = new McpClient({
      pythonPath: this.options.pythonPath,
      cwd: this.options.cwd,
      timeoutMs: this.options.timeoutMs,
    });

    this.processExit = this.processExit.bind(this);
    this._sigintHandler = () => this.gracefulShutdown();
    this._sigtermHandler = () => this.gracefulShutdown();
    process.on("SIGINT", this._sigintHandler);
    process.on("SIGTERM", this._sigtermHandler);
  }

  async start(): Promise<void> {
    await this.mcp.start();

    this.mcp.getProcess()?.on("exit", (code, signal) => {
      if (this.shutdownInProgress) return;
      this.handleProcessExit(code ?? -1, signal ?? "unknown");
    });
  }

  private handleProcessExit(code: number, signal: string): void {
    if (this.autoRestart && this.restartCount < this.maxRestarts) {
      this.restartCount++;
      const delay = Math.min(1000 * Math.pow(2, this.restartCount), 30000);
      console.warn(
        `[lifecycle] Process died unexpectedly. Restart #${this.restartCount} in ${delay}ms`
      );

      this.restartTimer = setTimeout(async () => {
        this.restartTimer = null;
        try {
          await this.mcp.start();
          this.restartCount = 0;
        } catch (err: any) {
          console.error(`[lifecycle] Restart failed: ${err.message}`);
          if (this.restartCount < this.maxRestarts) {
            this.handleProcessExit(-1, "SIGABRT");
          }
        }
      }, delay);
    } else {
      console.error(
        "[lifecycle] Max restarts reached or auto-restart disabled. Exiting."
      );
      this.processExit(1);
    }
  }

  async gracefulShutdown(): Promise<void> {
    if (this.shutdownInProgress) return;
    this.shutdownInProgress = true;
    process.removeListener("SIGINT", this._sigintHandler);
    process.removeListener("SIGTERM", this._sigtermHandler);
    process.stdout.write("[lifecycle] Graceful shutdown initiated");

    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    try {
      await this.mcp.shutdown("SIGTERM");
    } catch (err: any) {
      console.error(`[lifecycle] Shutdown error: ${err.message}`);
    }

    this.processExit(0);
  }
}
