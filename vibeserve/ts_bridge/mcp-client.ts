import { spawn, ChildProcess } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class McpClient {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pending = new Map<number, PendingRequest>();
  private buffer = "";
  private ready = false;
  private readyPromise: Promise<void>;
  private readyResolve!: () => void;
  private readyReject!: (err: Error) => void;
  private dead = false;
  private pythonPath: string;
  private cwd: string;
  private timeoutMs: number;

  constructor(options?: { pythonPath?: string; cwd?: string; timeoutMs?: number }) {
    this.pythonPath = options?.pythonPath ?? "python";
    this.cwd = options?.cwd ?? join(__dirname, "..", "..");
    this.timeoutMs = options?.timeoutMs ?? 30000;
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
  }

  async start(): Promise<void> {
    if (this.process) return;

    this.dead = false;
    this.process = spawn(this.pythonPath, ["-m", "vibeserve"], {
      cwd: this.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
      windowsHide: true,
    });

    this.process.stdout?.on("data", (data: Buffer) => this.onStdout(data));
    this.process.stderr?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) console.error(`[python:stderr] ${trimmed}`);
      }
    });

    this.process.on("error", (err) => {
      if (this.dead) return;
      console.error(`[mcp-client] Process error: ${err.message}`);
    });

    this.process.on("exit", (code, signal) => {
      if (this.dead) return;
      console.warn(
        `[mcp-client] Process exited (code=${code}, signal=${signal})`
      );
      this.process = null;
      this.ready = false;
      const exitErr = new Error(`Python process exited (code=${code}, signal=${signal})`);
      this.readyReject(exitErr);
      this.rejectAllPending(exitErr);
    });

    try {
      await this.initialize();
    } catch (err) {
      this.readyReject(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  private async initialize(): Promise<void> {
    const initResult = await this.sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "vibeserve-ts-bridge", version: "1.0.0" },
    });

    if (!initResult || typeof initResult !== "object") {
      throw new Error("Invalid initialize response from Python MCP");
    }

    this.sendNotification("notifications/initialized", {});

    this.ready = true;
    this.readyResolve();
    process.stdout.write("[mcp-client] MCP connection initialized");
  }

  private onStdout(data: Buffer): void {
    this.buffer += data.toString();

    if (this.buffer.length > 10 * 1024 * 1024) {
      console.warn("[mcp-client] stdout buffer exceeded 10MB limit, clearing");
      this.buffer = "";
      return;
    }

    while (true) {
      const newlineIdx = this.buffer.indexOf("\n");
      if (newlineIdx === -1) break;

      const line = this.buffer.substring(0, newlineIdx).trim();
      this.buffer = this.buffer.substring(newlineIdx + 1);

      if (!line) continue;

      try {
        const msg = JSON.parse(line) as JsonRpcResponse;
        if (msg.id !== undefined && msg.id !== null) {
          const pending = this.pending.get(msg.id);
          if (pending) {
            clearTimeout(pending.timer);
            this.pending.delete(msg.id);
            if (msg.error) {
              pending.reject(
                new Error(`MCP error ${msg.error.code}: ${msg.error.message}`)
              );
            } else {
              pending.resolve(msg.result);
            }
          }
        }
      } catch {
        console.debug(`[mcp-client] Non-JSON stdout: ${line.substring(0, 100)}`);
      }
    }
  }

  async sendRequest(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.process || (!this.process.stdin)) {
      throw new Error("MCP client not started");
    }

    const id = ++this.requestId;
    const request = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    }) + "\n";

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request '${method}' timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      this.process!.stdin!.write(request, "utf8", (err) => {
        if (err) {
          const pending = this.pending.get(id);
          if (pending) {
            this.pending.delete(id);
            pending.reject(err);
          }
        }
      });
    });
  }

  sendNotification(method: string, params: Record<string, unknown> = {}): void {
    if (!this.process || (!this.process.stdin)) return;

    const notification = JSON.stringify({
      jsonrpc: "2.0",
      method,
      params,
    }) + "\n";

    this.process.stdin.write(notification, "utf8", (err) => {
      if (err) {
        console.error(`[mcp-client] stdin write error:`, err);
      }
    });
  }

  async listTools(): Promise<unknown> {
    return this.sendRequest("tools/list", {});
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    return this.sendRequest("tools/call", { name, arguments: args });
  }

  async waitForReady(): Promise<void> {
    return this.readyPromise;
  }

  isReady(): boolean {
    return this.ready;
  }

  getProcess(): ChildProcess | null {
    return this.process;
  }

  async shutdown(signal: NodeJS.Signals = "SIGTERM"): Promise<void> {
    this.dead = true;

    if (!this.process) return;

    const pid = this.process.pid;
    process.stdout.write(`[mcp-client] Shutting down Python process (pid=${pid}) with ${signal}`);

    this.rejectAllPending(new Error("Bridge shutting down"));

    this.process.stdin?.end();
    this.process.kill(signal);

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (this.process) {
          console.warn("[mcp-client] Force killing Python process after timeout");
          this.process.kill("SIGKILL");
        }
        resolve();
      }, 5000);

      this.process?.on("exit", () => {
        clearTimeout(timeout);
        resolve();
      });

      if (!this.process) {
        clearTimeout(timeout);
        resolve();
      }
    });

    this.process = null;
    this.ready = false;
  }

  private rejectAllPending(err: Error): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(err);
    }
    this.pending.clear();
  }
}
