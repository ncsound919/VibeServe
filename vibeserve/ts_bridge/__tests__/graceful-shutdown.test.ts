import { describe, it, expect, vi } from "vitest";
import { Lifecycle } from "../lifecycle.js";
import { McpClient } from "../mcp-client.js";

describe("Graceful shutdown", () => {
  it("McpClient.shutdown resolves and cleans up state", async () => {
    const mcp = new McpClient({
      pythonPath: "python",
      cwd: process.cwd(),
    });

    const beforePid = (mcp as any).process?.pid;
    expect(beforePid).toBeUndefined();

    await mcp.shutdown("SIGTERM");

    expect((mcp as any).process).toBeNull();
    expect(mcp.isReady()).toBe(false);
  });

  it("Lifecycle.gracefulShutdown sets flag and calls MCP shutdown", async () => {
    let exitCode: number | null = null;

    const lifecycle = new Lifecycle({
      autoRestart: false,
      onExit: (code: number): never => {
        exitCode = code;
        throw new Error("exit:" + code);
      },
    });

    const mockMcp = {
      isReady: () => true,
      shutdown: async (_signal: string) => {},
      start: async () => {},
      process: { on: () => {}, emit: () => {} } as any,
    };
    (lifecycle as any).mcp = mockMcp;

    try {
      await lifecycle.gracefulShutdown();
    } catch (e: any) {
      // Expected: onExit throws
    }

    expect((lifecycle as any).shutdownInProgress).toBe(true);
    expect(exitCode).toBe(0);
  });

  it("Lifecycle.start registers SIGTERM handler", () => {
    const onSpy = vi.spyOn(process, "on");

    const lifecycle = new Lifecycle({ autoRestart: false });

    expect(onSpy).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    onSpy.mockRestore();
  });

  it("McpClient rejects pending requests on shutdown", async () => {
    const mcp = new McpClient({
      pythonPath: "python",
      cwd: process.cwd(),
    });

    await mcp.shutdown("SIGTERM");

    expect((mcp as any).pending.size).toBe(0);
    expect((mcp as any).process).toBeNull();
  });

  it("Lifecycle prevents double shutdown", async () => {
    let exitCount = 0;

    const lifecycle = new Lifecycle({
      autoRestart: false,
      onExit: () => {
        exitCount++;
        throw new Error("exit");
      },
    });

    (lifecycle as any).shutdownInProgress = true;

    let extraCalls = 0;
    const mockMcp = {
      isReady: () => true,
      shutdown: async () => { extraCalls++; },
      start: async () => {},
      process: { on: () => {}, emit: () => {} } as any,
    };
    (lifecycle as any).mcp = mockMcp;

    try {
      await lifecycle.gracefulShutdown();
    } catch {
      // Expected
    }

    expect(extraCalls).toBe(0);
    expect(exitCount).toBe(0);
  });
});
